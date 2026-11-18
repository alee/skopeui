import type {
  TimeseriesRequest,
  TimeseriesResponse,
  Series,
} from "@/types/timeseries";
import type {
  AnalysisOptions,
  DraftTimeseriesRequest,
  SavedAnalysisRequest,
} from "@/types/api";
import { defineStore } from "pinia";
import { useDatasetStore } from "@/stores/dataset";
import { formatStats } from "@/utils/stats";
import { stableJson } from "@/utils/extractionIdentity";
import { yearOfTimestep } from "@/utils/timeAxis";

export type AnalysisFormDraft = {
  zonalStatistic: TimeseriesRequest["zonal_statistic"];
  smoothingOption: string;
  smoothingTimeStep: number;
  transformOption: string;
  zScoreMovingIntervalTimeSteps: number;
  timeRange: {
    lb: { year: number; month: number };
    ub: { year: number; month: number };
  };
};

const EMPTY_RESPONSE: TimeseriesResponse = {
  area: 0,
  n_cells: 1,
  series: [],
  zonal_statistic: "mean",
  dataset_id: "",
  variable_id: "",
  summary_stats: [],
  transform: { type: "NoTransform" },
};

export const useAnalysisStore = defineStore("analysis", {
  state: () => ({
    response: { ...EMPTY_RESPONSE },
    completedRequest: null as SavedAnalysisRequest | null,
    formDrafts: {} as Record<string, AnalysisFormDraft>,
    // Only analysis choices are stored here; dataset, geometry and range
    // always come from the active dataset selection.
    requestOptions: null as Partial<AnalysisOptions> | null,
  }),
  // Requests follow the selection; plots and summaries follow the response.
  getters: {
    requestData(state): DraftTimeseriesRequest | Record<string, never> {
      if (!state.requestOptions) return {};
      return {
        ...useDatasetStore().defaultApiRequestData,
        ...state.requestOptions,
      };
    },
    hasCurrentResult(): boolean {
      return (
        this.completedRequest != null &&
        useDatasetStore().timeSeriesRequestStatus.status === "success" &&
        stableJson(this.completedRequest) === stableJson(this.requestData)
      );
    },
    timeseries: (state) => {
      return (state.response?.series || []).map((s: Series) => ({
        x: s.timesteps.map(yearOfTimestep),
        y: s.values,
        name: s.options?.name,
      }));
    },
    summaryStatistics: (state) =>
      formatStats(state.response?.summary_stats || []),
  },
  actions: {
    setDefaultRequestData(requestData: Partial<DraftTimeseriesRequest>) {
      this.setRequestData(requestData);
      this.clear();
    },
    setResponse(response: TimeseriesResponse, request?: TimeseriesRequest) {
      this.response = response;
      this.completedRequest = request?.time_range
        ? (JSON.parse(JSON.stringify(request)) as SavedAnalysisRequest)
        : null;
    },
    /** Drops the last response, e.g. when the study area changes. */
    clear() {
      this.response = { ...EMPTY_RESPONSE };
      this.completedRequest = null;
    },
    setRequestData(requestData: Partial<DraftTimeseriesRequest>) {
      const {
        zonal_statistic,
        transform,
        requested_series_options,
        max_processing_time,
      } = requestData;
      this.requestOptions = Object.fromEntries(
        Object.entries({
          zonal_statistic,
          transform,
          requested_series_options,
          max_processing_time,
        }).filter(([, value]) => value !== undefined),
      );
    },
  },
});
