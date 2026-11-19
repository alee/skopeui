import { RequestFailure } from "@/utils/requestJson";
import type { DraftTimeseriesRequest } from "@/types/api";
import { parseTimeseriesRequest } from "@/utils/savedAnalysis";
import { onScopeDispose } from "vue";
import { useExtractionStore } from "@/stores/extraction";
import { useDatasetStore } from "@/stores/dataset";
import { useAnalysisStore } from "@/stores/analysis";
import { useMessagesStore } from "@/stores/messages";
import { yearOfTimestep } from "@/utils/timeAxis";

/** Page-owned presentation; shared extractions continue across page changes. */
export function useTimeSeriesRequest(mode: "visualize" | "analyze") {
  const extraction = useExtractionStore();
  const dataset = useDatasetStore();
  const analysis = useAnalysisStore();
  const messages = useMessagesStore();
  let disposed = false;
  onScopeDispose(() => {
    disposed = true;
  });

  async function run(data: DraftTimeseriesRequest) {
    if (disposed) return;
    const ownsRequest = extraction.beginRequest();
    const isCurrent = () => !disposed && ownsRequest();
    if (!data.selected_area) {
      dataset.setTimeSeriesNoArea();
      return;
    }
    if (!dataset.canHandleTimeSeriesRequest) return;
    dataset.setTimeSeriesLoading();
    try {
      const request = parseTimeseriesRequest(data);
      const response = await extraction.resolveTimeSeries(request);
      if (!isCurrent()) return;
      if (mode === "analyze") {
        analysis.setResponse(response, request);
        dataset.setAreaSummary(response.n_cells, response.area);
      } else {
        const original = response.series[0];
        if (!original) throw new Error("The API returned no time series.");
        dataset.setTimeSeries({
          timeSeries: {
            x: original.timesteps.map(yearOfTimestep),
            y: original.values,
            options: original.options,
          },
          numberOfCells: response.n_cells,
          area: response.area,
        });
      }
      dataset.setTimeSeriesLoaded();
    } catch (error: any) {
      if (!isCurrent()) return;
      if (mode === "visualize") dataset.clearTimeSeries();
      const status = error.response?.status;
      const rawDetail = error.response?.data?.detail;
      if (error instanceof RequestFailure && error.code === "SUPERSEDED")
        return;
      const detail = Array.isArray(rawDetail)
        ? rawDetail
        : [
            {
              msg:
                rawDetail?.msg ??
                rawDetail ??
                error.message ??
                "Unknown request error.",
            },
          ];
      const message = detail.map((entry: any) => entry.msg).join(" ");
      const code =
        error instanceof RequestFailure ? error.code : rawDetail?.code;
      if (code === "PROCESSING_TIMEOUT") {
        dataset.setTimeSeriesTimeout();
        messages.error(
          "This area took too long to process. Try a smaller one on the Select Area step.",
        );
      } else if (
        [
          "HTTP_TIMEOUT",
          "NETWORK_ERROR",
          "SUBMISSION_TIMEOUT",
          "POLLING_TIMEOUT",
          "ANALYSIS_TIMEOUT",
          "WORKER_LOST",
          "SCHEDULING_FAILED",
          "CAPACITY_EXHAUSTED",
          "COORDINATION_UNAVAILABLE",
        ].includes(code) ||
        status === 504
      ) {
        // A gateway/connection timeout says nothing about the selected area's
        // size. Retrying reconnects to the accepted job when it is available.
        dataset.setTimeSeriesServerError(detail);
        messages.error(message);
      } else if (status >= 400 && status < 500) {
        dataset.setTimeSeriesBadRequest(detail);
        if (mode === "analyze" && status === 422) {
          messages.warning(
            message || "These options can't be computed. Please choose others.",
          );
        } else {
          messages.error(message || "Bad request.");
        }
      } else {
        dataset.setTimeSeriesServerError(detail);
        messages.error(message || "Server error. Please try again.");
      }
    }
  }

  return { run };
}
