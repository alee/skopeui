import type {
  TimeseriesRequest,
  TimeseriesAnalyzeRequest,
  TimeseriesResponse,
  JobStatusResponse,
} from "@/types/timeseries";
import type {
  ExtractionAcceptedResponse,
  SuccessfulJobStatus,
} from "@/types/api";
import {
  TIMESERIES_SUBMIT_ENDPOINT,
  TIMESERIES_STATUS_ENDPOINT,
  TIMESERIES_REFINE_ENDPOINT,
} from "@/store/modules/constants";
import { requestJson } from "@/utils/requestJson";

// Preserve the capacity and polling deadlines independently of page lifetimes.
const CAPACITY_RETRY_SECONDS = 5;
const CAPACITY_WAIT_LIMIT_MS = 60_000;

export async function submitTimeSeriesRequest(
  requestData: TimeseriesRequest,
  isCurrent = () => true,
) {
  const deadline = Date.now() + CAPACITY_WAIT_LIMIT_MS;
  for (;;) {
    if (!isCurrent()) throw new Error("Extraction request superseded");
    try {
      const result = await requestJson<ExtractionAcceptedResponse>(
        TIMESERIES_SUBMIT_ENDPOINT,
        {
          method: "POST",
          body: JSON.stringify(requestData),
        },
      );
      return result.job_id;
    } catch (error: any) {
      const waitMs =
        (error.response?.retryAfter ?? CAPACITY_RETRY_SECONDS) * 1000;
      if (error.response?.status !== 503 || Date.now() + waitMs > deadline) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

export async function pollTimeSeriesStatus(
  jobId: string,
): Promise<SuccessfulJobStatus> {
  const statusUrl = `${TIMESERIES_STATUS_ENDPOINT}/${jobId}`;
  let result = await requestJson<JobStatusResponse>(`${statusUrl}`);
  const timeoutSeconds = 60;
  const deadline = Date.now() + timeoutSeconds * 1000;

  while (
    result.status !== "SUCCESS" &&
    result.status !== "FAILED" &&
    result.status !== "TIMED_OUT" &&
    Date.now() < deadline
  ) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    result = await requestJson<JobStatusResponse>(`${statusUrl}`);
  }

  if (result.status === "SUCCESS") {
    if (!result.result)
      throw new Error("The extraction succeeded without a result.");
    return { status: "SUCCESS", result: result.result, error: result.error };
  }
  if (result.status === "FAILED") {
    const error = new Error(
      `Request failed with status ${result.status}`,
    ) as Error & {
      response?: { status: number; data: unknown };
    };
    const failMsg: string = result.error ?? "Analysis job failed";
    error.response = {
      status: 500,
      data: { detail: [{ msg: failMsg }] },
    };
    throw error;
  }
  // The API stopped the job at its deadline, or we stopped waiting. Either
  // way it's a timeout (504), which the pages report and never resubmit.
  const error = new Error("Request timed out") as Error & {
    response?: { status: number; data: unknown };
  };
  error.response = {
    status: 504,
    data: {
      detail: [
        {
          msg:
            result.error ??
            "Request timed out after waiting for " +
              timeoutSeconds +
              " seconds",
        },
      ],
    },
  };
  throw error;
}

export async function refineTimeSeriesAnalysis(
  jobId: string,
  requestData: TimeseriesRequest,
) {
  const requestPayload: TimeseriesAnalyzeRequest = {
    extraction_id: jobId,
    zonal_statistic: requestData.zonal_statistic,
    transform: requestData.transform,
    requested_series_options: requestData.requested_series_options,
    time_range: requestData.time_range,
  };
  return await requestJson<TimeseriesResponse>(TIMESERIES_REFINE_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(requestPayload),
  });
}
