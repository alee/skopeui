import { hasStudyArea } from "@/utils/studyArea";
import type { DraftTimeseriesRequest } from "@/types/api";
import { defaultAnalysisOptions } from "@/types/api";
import { defineStore } from "pinia";
import { toISODate } from "@/utils/stats";
import type { Dataset, Variable } from "@/types/metadata";
import { useAnalysisStore } from "@/stores/analysis";
import { extractionGeometry, stableJson } from "@/utils/extractionIdentity";
import { timeSpan } from "@/utils/timeAxis";

type TimeSeriesRequestStatus = {
  status:
    | "loading"
    | "success"
    | "timeout"
    | "no-area"
    | "badrequest"
    | "servererror";
  messages: Array<{ type: "info" | "warning" | "error"; value: string }>;
};

const LOADING_STATUS: TimeSeriesRequestStatus = {
  status: "loading",
  messages: [{ type: "warning", value: "Loading time series data." }],
};
const SUCCESS_STATUS: TimeSeriesRequestStatus = {
  status: "success",
  messages: [{ type: "info", value: "Success" }],
};
const TIMEOUT_STATUS: TimeSeriesRequestStatus = {
  status: "timeout",
  messages: [
    {
      type: "error",
      value: "Timeout exceeded, please try again with a smaller study area.",
    },
  ],
};
const NO_STUDY_AREA_STATUS: TimeSeriesRequestStatus = {
  status: "no-area",
  messages: [
    {
      type: "error",
      value: "Please enter a study area.",
    },
  ],
};

type DatasetVariable = Partial<Omit<Variable, "id">> & { id: string | null };

/** Where a dataset's study area is kept in the browser. */
export function studyAreaKey(datasetId: string) {
  return `geojson:${datasetId}`;
}

export const useDatasetStore = defineStore("dataset", {
  state: () => ({
    timeSeries: {
      x: [] as number[],
      y: [] as Array<number | null>,
      options: { name: "Original" as string },
    },
    hasData: false,
    metadata: null as Dataset | null,
    initializationVersion: 0,
    variableId: null as string | null,
    visualizeStep: null as number | null,
    temporalRangeDraft: null as {
      range: [number, number];
      min: number;
      max: number;
    } | null,
    geoJson: null as unknown,
    // Session overrides for study-area writes that browser storage rejected.
    unpersistedStudyAreas: {} as Record<string, unknown>,
    temporalRange: [1, new Date().getFullYear()] as [number, number],
    timeSeriesRequestStatus: { ...LOADING_STATUS },
    // The API's area: the selected shape, measured in the dataset's CRS. Both
    // are 0 until a time series comes back.
    areaInSquareKm: 0,
    numberOfCells: 0,
  }),
  getters: {
    variable: (state): DatasetVariable =>
      state.metadata?.variables.find(
        (variable) => variable.id === state.variableId,
      ) ?? { id: null },
    hasGeoJson: (state) => hasStudyArea(state.geoJson),
    temporalRangeMin: (state) => state.temporalRange[0],
    temporalRangeMax: (state) => state.temporalRange[1],
    minYear: (state) =>
      state.metadata?.time ? timeSpan(state.metadata.time)[0] : 1,
    maxYear: (state) =>
      state.metadata?.time
        ? timeSpan(state.metadata.time)[1]
        : new Date().getFullYear(),
    canHandleTimeSeriesRequest(): boolean {
      return !!this.metadata && this.hasGeoJson && this.variable.id != null;
    },
    timeSeriesRequestData(): DraftTimeseriesRequest {
      return this.defaultApiRequestData;
    },
    timeseriesTrace: (state) => {
      if (!state.hasData) return null;
      return {
        x: state.timeSeries.x,
        y: state.timeSeries.y,
        name: state.timeSeries.options?.name || "Original",
      };
    },
    geoJsonKey: (state) => {
      const metadataId = state.metadata?.id;
      return metadataId ? studyAreaKey(metadataId) : "skope:geometry";
    },
    defaultApiRequestData(): DraftTimeseriesRequest {
      const [minYear, maxYear] = this.temporalRange;
      return {
        dataset_id: this.metadata?.id,
        variable_id: this.variable.id,
        selected_area: this.geoJson,
        time_range: {
          gte: toISODate(minYear),
          lte: toISODate(maxYear),
        },
        ...defaultAnalysisOptions(),
      };
    },
  },
  actions: {
    // Each source transition invalidates both presentations. Extraction jobs
    // have their own identity and are retired by the extraction store.
    invalidateResults() {
      this.clearTimeSeries();
      useAnalysisStore().clear();
    },
    setVariable(variableId: string | null) {
      if (this.variableId === variableId) return;
      this.variableId = variableId;
      this.invalidateResults();
    },
    setTemporalRange(temporalRange: [number, number]) {
      if (
        this.temporalRange[0] === temporalRange[0] &&
        this.temporalRange[1] === temporalRange[1]
      )
        return;
      this.temporalRange = [...temporalRange];
      // The original extraction remains reusable for a different range.
      useAnalysisStore().clear();
    },
    beginInitialization() {
      const version = ++this.initializationVersion;
      return () => version === this.initializationVersion;
    },
    setMetadata(metadata: Dataset | null) {
      // A newer selection (including clearing it) supersedes pending loads.
      this.initializationVersion++;
      const previous = this.metadata;
      if (stableJson(previous) === stableJson(metadata)) return;
      const previousVariableId = this.variable.id;
      const changedDataset = previous?.id !== metadata?.id;
      const changedSource =
        changedDataset ||
        previous?.release_id !== metadata?.release_id ||
        previous?.declaration_digest !== metadata?.declaration_digest;
      this.metadata = metadata;
      if (changedSource) {
        this.visualizeStep = null;
        this.temporalRangeDraft = null;
      }
      if (changedDataset) {
        // Persistence is dataset-scoped; useStudyArea restores the new area's
        // saved geometry after selecting its metadata.
        this.geoJson = null;
        this.variableId = null;
      }
      if (metadata) {
        if (this.variableId == null) {
          this.variableId =
            metadata.default_variable ?? metadata.variables[0]?.id ?? null;
        }
        if (changedSource && metadata.time)
          this.temporalRange = timeSpan(metadata.time);
      } else {
        this.variableId = null;
        this.temporalRange = [1, new Date().getFullYear()];
      }
      if (changedSource || previousVariableId !== this.variable.id || !metadata)
        this.invalidateResults();
    },
    setGeoJson(geoJson: unknown) {
      if (stableJson(this.geoJson) === stableJson(geoJson)) return;
      const changedGeometry =
        stableJson(
          this.hasGeoJson ? extractionGeometry(this.geoJson) : null,
        ) !== stableJson(extractionGeometry(geoJson));
      this.geoJson = geoJson;
      if (changedGeometry) this.invalidateResults();
    },
    clearGeoJson() {
      this.setGeoJson(null);
    },
    setTimeSeriesLoading() {
      this.timeSeriesRequestStatus = { ...LOADING_STATUS };
    },
    setTimeSeriesLoaded() {
      this.timeSeriesRequestStatus = { ...SUCCESS_STATUS };
    },
    setTimeSeriesTimeout() {
      this.timeSeriesRequestStatus = { ...TIMEOUT_STATUS };
    },
    setTimeSeriesBadRequest(errorDetails: Array<{ msg: string }>) {
      this.timeSeriesRequestStatus = {
        status: "badrequest",
        messages: errorDetails.map((detail) => ({
          type: "error",
          value: detail.msg,
        })),
      };
    },
    setTimeSeriesServerError(errorDetails: Array<{ msg: string }>) {
      this.timeSeriesRequestStatus = {
        status: "servererror",
        messages: errorDetails.map((detail) => ({
          type: "error",
          value: detail.msg,
        })),
      };
    },
    setTimeSeriesNoArea() {
      this.timeSeriesRequestStatus = { ...NO_STUDY_AREA_STATUS };
    },
    setTimeSeries(payload: {
      timeSeries: {
        x: number[];
        y: Array<number | null>;
        options?: { name?: string };
      };
      numberOfCells: number;
      area: number;
    }) {
      this.hasData = true;
      this.timeSeries = {
        ...payload.timeSeries,
        options: { name: payload.timeSeries.options?.name ?? "Original" },
      };
      this.setAreaSummary(payload.numberOfCells, payload.area);
    },
    /** The response's cell count and area, in square metres. */
    setAreaSummary(numberOfCells: number, areaInSquareMeters: number) {
      this.numberOfCells = numberOfCells;
      this.areaInSquareKm = areaInSquareMeters / 1e6;
    },
    clearTimeSeries() {
      this.hasData = false;
      // Back to the initial state: no "success" left over from the old data.
      this.timeSeriesRequestStatus = { ...LOADING_STATUS };
      this.timeSeries = { x: [], y: [], options: { name: "Original" } };
      this.setAreaSummary(0, 0);
    },
    // The points whose timestep falls in the selected range. Each x comes from
    // the response's timesteps, so this holds on any axis.
    filteredTimeSeries() {
      const [start, end] = this.temporalRange;
      const { x, y } = this.timeSeries;
      const inRange = x.flatMap((year, i) =>
        year >= start && year <= end ? [i] : [],
      );
      return {
        x: inRange.map((i) => x[i]),
        y: inRange.map((i) => y[i]),
        name: this.timeSeries.options?.name || "Original",
      };
    },
  },
});
