import type {
  TimeseriesRequest,
  TimeseriesAnalyzeRequest,
  TimeseriesResponse,
  JobStatusResponse,
  ExtractionAcceptedResponse,
} from "@/types/timeseries";
import type { SuccessfulJobStatus } from "@/types/api";
import { createApiEndpoints } from "@/utils/apiEndpoints";
import { requestJson, RequestFailure } from "@/utils/requestJson";

export const TIME_SERIES_BUDGETS = {
  submission: 60_000,
  polling: 60_000,
  operation: 15_000,
  analysis: 30_000,
} as const;
export interface ExtractionAttempt {
  key: string;
  releaseId?: string;
  declarationDigest?: string;
  signal?: AbortSignal;
}

function phaseExpired(phase: "submission" | "polling") {
  return new RequestFailure(
    phase === "submission" ? "SUBMISSION_TIMEOUT" : "POLLING_TIMEOUT",
    phase === "submission"
      ? "Unable to confirm extraction acceptance. Retry to recover the same job."
      : "The server has not reported completion yet. Retry to reconnect to the same job.",
  );
}
function checkSignal(signal?: AbortSignal) {
  if (signal?.aborted)
    throw new RequestFailure("SUPERSEDED", "Extraction request superseded");
}
async function wait(
  ms: number,
  signal: AbortSignal | undefined,
  deadline: number,
  phase: "submission" | "polling",
) {
  checkSignal(signal);
  const remaining = deadline - performance.now();
  if (remaining <= 0) throw phaseExpired(phase);
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(new RequestFailure("SUPERSEDED", "Extraction request superseded"));
    };
    const timer = setTimeout(
      () => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      },
      Math.min(ms, remaining),
    );
    signal?.addEventListener("abort", onAbort, { once: true });
  });
  if (performance.now() >= deadline) throw phaseExpired(phase);
}
function retryable(error: unknown) {
  return (
    error instanceof RequestFailure &&
    ([
      "NETWORK_ERROR",
      "HTTP_TIMEOUT",
      "COORDINATION_UNAVAILABLE",
      "CAPACITY_EXHAUSTED",
    ].includes(error.code) ||
      (error.code === "HTTP_ERROR" &&
        [502, 503, 504].includes(error.response?.status ?? 0)))
  );
}

export function createTimeSeriesApi(apiBase: string) {
  const endpoints = createApiEndpoints(apiBase);
  async function submitTimeSeriesRequest(
    requestData: TimeseriesRequest,
    attempt: ExtractionAttempt = { key: crypto.randomUUID() },
  ) {
    const deadline = performance.now() + TIME_SERIES_BUDGETS.submission;
    const body = JSON.stringify(requestData);
    const headers: Record<string, string> = { "Idempotency-Key": attempt.key };
    if (attempt.releaseId && attempt.declarationDigest) {
      headers["X-Skope-Release-Id"] = attempt.releaseId;
      headers["X-Skope-Declaration-Digest"] = attempt.declarationDigest;
    }
    let lastError: unknown;
    for (;;) {
      checkSignal(attempt.signal);
      if (performance.now() >= deadline) {
        if (
          lastError instanceof RequestFailure &&
          lastError.code === "CAPACITY_EXHAUSTED"
        )
          throw lastError;
        throw phaseExpired("submission");
      }
      try {
        const result = await requestJson<ExtractionAcceptedResponse>(
          endpoints.extract,
          {
            method: "POST",
            headers,
            body,
            signal: attempt.signal,
          },
          { deadline, timeoutMs: TIME_SERIES_BUDGETS.operation },
        );
        if (!result.job_id)
          throw new RequestFailure(
            "INVALID_RESPONSE",
            "The extraction service returned no job ID.",
          );
        return result.job_id;
      } catch (error) {
        if (!retryable(error)) throw error;
        lastError = error;
        const retryAfter =
          error instanceof RequestFailure
            ? error.response?.retryAfter
            : undefined;
        try {
          await wait(
            Math.max(100, (retryAfter ?? 5) * 1000),
            attempt.signal,
            deadline,
            "submission",
          );
        } catch (timeout) {
          if (
            timeout instanceof RequestFailure &&
            timeout.code === "SUBMISSION_TIMEOUT" &&
            error instanceof RequestFailure &&
            error.code === "CAPACITY_EXHAUSTED"
          )
            throw error;
          throw timeout;
        }
      }
    }
  }

  async function pollTimeSeriesStatus(
    jobId: string,
    signal?: AbortSignal,
  ): Promise<SuccessfulJobStatus> {
    const deadline = performance.now() + TIME_SERIES_BUDGETS.polling;
    for (;;) {
      checkSignal(signal);
      if (performance.now() >= deadline) throw phaseExpired("polling");
      let result: JobStatusResponse;
      try {
        result = await requestJson<JobStatusResponse>(
          `${endpoints.status}/${jobId}`,
          { signal },
          { deadline, timeoutMs: TIME_SERIES_BUDGETS.operation },
        );
      } catch (error) {
        if (!retryable(error)) throw error;
        await wait(1000, signal, deadline, "polling");
        continue;
      }
      if (result.status === "SUCCESS") {
        if (!result.result)
          throw new RequestFailure(
            "INVALID_RESPONSE",
            "The extraction succeeded without a result.",
          );
        return {
          status: "SUCCESS",
          result: result.result,
          error: result.error,
        };
      }
      if (result.status === "FAILED" || result.status === "TIMED_OUT") {
        throw new RequestFailure(
          result.error_code ??
            (result.status === "TIMED_OUT"
              ? "PROCESSING_TIMEOUT"
              : "EXTRACTION_FAILED"),
          result.error ?? "The extraction failed. Start a new attempt.",
        );
      }
      if (!["PENDING", "PROCESSING"].includes(result.status))
        throw new RequestFailure(
          "INVALID_RESPONSE",
          "The extraction returned an unknown job status.",
        );
      await wait(1000, signal, deadline, "polling");
    }
  }

  async function refineTimeSeriesAnalysis(
    jobId: string,
    requestData: TimeseriesRequest,
    signal?: AbortSignal,
  ) {
    const payload: TimeseriesAnalyzeRequest = {
      extraction_id: jobId,
      zonal_statistic: requestData.zonal_statistic,
      transform: requestData.transform,
      requested_series_options: requestData.requested_series_options,
      time_range: requestData.time_range,
    };
    return await requestJson<TimeseriesResponse>(
      endpoints.analyze,
      { method: "POST", body: JSON.stringify(payload), signal },
      { timeoutMs: TIME_SERIES_BUDGETS.analysis },
    );
  }
  return {
    submitTimeSeriesRequest,
    pollTimeSeriesStatus,
    refineTimeSeriesAnalysis,
  };
}
