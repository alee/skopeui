import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { useDatasetStore } from "@/stores/dataset";
import { extractionIdentity, stableJson } from "@/utils/extractionIdentity";
import { RequestFailure } from "@/utils/requestJson";
import { createTimeSeriesApi } from "@/utils/timeSeriesApi";
import { useRuntimeConfig } from "nuxt/app";

import type { TimeseriesRequest, TimeseriesResponse } from "@/types/timeseries";
type RequestData = TimeseriesRequest;
type ExtractionResult = {
  jobId: string;
  response: TimeseriesResponse;
  requestKey: string;
};

export const useExtractionStore = defineStore("extraction", () => {
  const {
    submitTimeSeriesRequest,
    pollTimeSeriesStatus,
    refineTimeSeriesAnalysis,
  } = createTimeSeriesApi(useRuntimeConfig().public.apiBase);
  const dataset = useDatasetStore();
  const jobIds = ref<Record<string, string>>({});
  // Promises stay within this Pinia instance, outside serializable store state.
  const pendingExtractions = new Map<string, Promise<ExtractionResult>>();
  const pendingRequests = new Map<string, Promise<TimeseriesResponse>>();
  const pendingPolls = new Map<
    string,
    ReturnType<typeof pollTimeSeriesStatus>
  >();
  // Keep the original payload and key across uncertain submission failures.
  // Later form choices are analyzed against the recovered extraction.
  const attempts = new Map<
    string,
    {
      key: string;
      request: RequestData;
      releaseId?: string;
      declarationDigest?: string;
    }
  >();
  let controller = new AbortController();
  let generation = 0;
  let latestRequest = 0;

  function clear() {
    controller.abort();
    controller = new AbortController();
    attempts.clear();
    generation++;
    latestRequest++;
    jobIds.value = {};
    pendingExtractions.clear();
    pendingRequests.clear();
    pendingPolls.clear();
  }

  function contextKey() {
    return stableJson([
      extractionIdentity(
        {
          dataset_id: dataset.metadata?.id,
          variable_id: dataset.variable?.id,
          selected_area: dataset.geoJson,
        },
        dataset.metadata,
      ),
      dataset.temporalRange,
    ]);
  }

  // Invalidate consumers synchronously, including an area changing away and
  // back before its old response arrives. Cached jobs still have full identities.
  watch(
    contextKey,
    () => {
      latestRequest++;
    },
    { flush: "sync" },
  );

  // A new source or study area retires cached and queued work. Variable
  // switches keep jobs reusable under their separate extraction identities.
  watch(
    () =>
      extractionIdentity(
        {
          dataset_id: dataset.metadata?.id,
          selected_area: dataset.geoJson,
        },
        dataset.metadata,
      ),
    clear,
    { flush: "sync" },
  );

  function beginRequest() {
    const token = ++latestRequest;
    return () => token === latestRequest;
  }

  function poll(jobId: string) {
    let pending = pendingPolls.get(jobId);
    if (!pending) {
      pending = pollTimeSeriesStatus(jobId, controller.signal).finally(() => {
        if (pendingPolls.get(jobId) === pending) pendingPolls.delete(jobId);
      });
      pendingPolls.set(jobId, pending);
    }
    return pending;
  }

  async function extract(key: string, request: RequestData, epoch: number) {
    let pending = pendingExtractions.get(key);
    if (!pending) {
      pending = (async () => {
        if (epoch !== generation)
          throw new RequestFailure(
            "SUPERSEDED",
            "Extraction request superseded",
          );
        let attempt = attempts.get(key);
        if (!attempt) {
          attempt = {
            key: crypto.randomUUID(),
            request,
            releaseId: dataset.metadata?.release_id,
            declarationDigest: dataset.metadata?.declaration_digest,
          };
          attempts.set(key, attempt);
        }
        const jobId = await submitTimeSeriesRequest(attempt.request, {
          ...attempt,
          signal: controller.signal,
        });
        if (epoch !== generation)
          throw new RequestFailure(
            "SUPERSEDED",
            "Extraction request superseded",
          );
        if (epoch === generation) jobIds.value[key] = jobId;
        const result = await poll(jobId);
        return {
          jobId,
          response: result.result,
          requestKey: stableJson(attempt.request),
        };
      })()
        .catch((error) => {
          if (
            epoch === generation &&
            (terminal(error) ||
              (error instanceof RequestFailure &&
                [400, 404, 422].includes(error.response?.status ?? 0)))
          ) {
            attempts.delete(key);
            delete jobIds.value[key];
          }
          throw error;
        })
        .finally(() => {
          if (pendingExtractions.get(key) === pending)
            pendingExtractions.delete(key);
        });
      pendingExtractions.set(key, pending);
    }
    return pending;
  }

  function terminal(error: unknown) {
    return (
      error instanceof RequestFailure &&
      [
        "PROCESSING_TIMEOUT",
        "WORKER_LOST",
        "SCHEDULING_FAILED",
        "EXTRACTION_FAILED",
        "INVALID_EXTRACTION",
        "UPSTREAM_FAILURE",
        "RESULT_EXPIRED",
        "SOURCE_CHANGED",
        "IDEMPOTENCY_CONFLICT",
      ].includes(error.code)
    );
  }

  async function resolve(key: string, request: RequestData, epoch: number) {
    const pending = pendingExtractions.get(key);
    const shared = pending ? await pending : undefined;
    if (epoch !== generation)
      throw new RequestFailure("SUPERSEDED", "Extraction request superseded");
    if (shared?.requestKey === stableJson(request)) return shared.response;
    // A shared extraction reads the whole axis, but its initial result uses
    // only the originating request's range, transform and smoothing options.
    const jobId = shared?.jobId ?? jobIds.value[key];
    if (jobId) {
      try {
        return await refineTimeSeriesAnalysis(
          jobId,
          request,
          controller.signal,
        );
      } catch (error: any) {
        const status = error.response?.status;
        if (terminal(error) && ![404, 410].includes(status)) {
          attempts.delete(key);
          delete jobIds.value[key];
          throw error;
        }
        if (![404, 409, 410].includes(status)) throw error;
        if (status === 409) {
          try {
            await poll(jobId);
            return await refineTimeSeriesAnalysis(
              jobId,
              request,
              controller.signal,
            );
          } catch (error: any) {
            // A terminal extraction requires a new user attempt; do not
            // automatically launch more expensive work in this request.
            if (terminal(error)) {
              attempts.delete(key);
              delete jobIds.value[key];
              throw error;
            }
            if (![404, 410].includes(error.response?.status)) throw error;
          }
        }
        if (epoch === generation && jobIds.value[key] === jobId) {
          delete jobIds.value[key];
          attempts.delete(key);
        }
      }
    }
    // Clearing a study area must not let old work start another extraction.
    if (epoch !== generation)
      throw new RequestFailure("SUPERSEDED", "Extraction request superseded");
    const fresh = await extract(key, request, epoch);
    if (epoch !== generation)
      throw new RequestFailure("SUPERSEDED", "Extraction request superseded");
    return fresh.requestKey === stableJson(request)
      ? fresh.response
      : refineTimeSeriesAnalysis(fresh.jobId, request, controller.signal);
  }

  function resolveTimeSeries(data: RequestData): Promise<TimeseriesResponse> {
    // Snapshot reactive input before any asynchronous work.
    const request = JSON.parse(JSON.stringify(data));
    const key = extractionIdentity(request, dataset.metadata);
    const requestKey = stableJson([key, request]);
    let pending = pendingRequests.get(requestKey);
    if (!pending) {
      pending = resolve(key, request, generation).finally(() => {
        if (pendingRequests.get(requestKey) === pending)
          pendingRequests.delete(requestKey);
      });
      pendingRequests.set(requestKey, pending);
    }
    return pending;
  }

  return { jobIds, clear, beginRequest, resolveTimeSeries };
});
