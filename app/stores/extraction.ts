import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { useDatasetStore } from "@/stores/dataset";
import { extractionIdentity, stableJson } from "@/utils/extractionIdentity";
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
  let generation = 0;
  let latestRequest = 0;

  function clear() {
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
      pending = pollTimeSeriesStatus(jobId).finally(() => {
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
        const jobId = await submitTimeSeriesRequest(
          request,
          () => epoch === generation,
        );
        if (epoch === generation) jobIds.value[key] = jobId;
        const result = await poll(jobId);
        return {
          jobId,
          response: result.result,
          requestKey: stableJson(request),
        };
      })().finally(() => {
        if (pendingExtractions.get(key) === pending)
          pendingExtractions.delete(key);
      });
      pendingExtractions.set(key, pending);
    }
    return pending;
  }

  async function resolve(key: string, request: RequestData, epoch: number) {
    const pending = pendingExtractions.get(key);
    const shared = pending ? await pending : undefined;
    if (epoch !== generation) throw new Error("Extraction request superseded");
    if (shared?.requestKey === stableJson(request)) return shared.response;
    // A shared extraction reads the whole axis, but its initial result uses
    // only the originating request's range, transform and smoothing options.
    const jobId = shared?.jobId ?? jobIds.value[key];
    if (jobId) {
      try {
        return await refineTimeSeriesAnalysis(jobId, request);
      } catch (error: any) {
        const status = error.response?.status;
        if (![404, 409, 410].includes(status)) throw error;
        if (status === 409) {
          try {
            await poll(jobId);
            return await refineTimeSeriesAnalysis(jobId, request);
          } catch (error: any) {
            // Request errors and timeouts propagate without resubmitting.
            if (![404, 410, 500].includes(error.response?.status)) throw error;
          }
        }
        if (epoch === generation && jobIds.value[key] === jobId) {
          delete jobIds.value[key];
        }
      }
    }
    // Clearing a study area must not let old work start another extraction.
    if (epoch !== generation) throw new Error("Extraction request superseded");
    const fresh = await extract(key, request, epoch);
    if (epoch !== generation) throw new Error("Extraction request superseded");
    return fresh.requestKey === stableJson(request)
      ? fresh.response
      : refineTimeSeriesAnalysis(fresh.jobId, request);
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
