import type { TimeseriesResponse } from "@/types/timeseries";
import { reactive } from "vue";
import { vi } from "vitest";

export const datasetMetadataFixture = {
  id: "paleocar",
  title: "PaleoCAR",
  description: "Paleoclimate dataset",
};

export const timeSeriesResponseFixture = {
  dataset_id: "paleocar",
  variable_id: "tasmax",
  zonal_statistic: "mean",
  transform: { type: "NoTransform" },
  n_cells: 2,
  area: 1200000,
  summary_stats: [{ name: "Original", mean: 1, median: 1, stdev: 0 }],
  series: [
    {
      time_range: { gte: "0001", lte: "0003" },
      timesteps: ["0001", "0002", "0003"],
      values: [10, 20, 30],
      options: { name: "Original", smoother: { type: "NoSmoother" } },
    },
  ],
} satisfies TimeseriesResponse;

export function createDatasetStore(overrides: Record<string, unknown> = {}) {
  const store = reactive({
    metadata: datasetMetadataFixture,
    variable: { id: "tasmax" },
    hasGeoJson: false,
    geoJson: null as unknown,
    temporalRange: [1, 3] as [number, number],
    temporalRangeMin: 1,
    temporalRangeMax: 3,
    minYear: 1,
    maxYear: 3,
    canHandleTimeSeriesRequest: true,
    timeSeriesRequestData: {
      dataset_id: "paleocar",
      variable_id: "tasmax",
      selected_area: { type: "FeatureCollection", features: [] },
      time_range: { gte: "0001-01-01", lte: "0003-01-01" },
    },
    timeSeriesRequestStatus: { status: "idle", messages: [] },
    defaultApiRequestData: {
      dataset_id: "paleocar",
      variable_id: "tasmax",
      selected_area: { type: "FeatureCollection", features: [] },
      time_range: { gte: "0001-01-01", lte: "0003-01-01" },
      max_processing_time: 20000,
    },
    clearTimeSeries: vi.fn(),
    setMetadata: vi.fn((value: unknown) => {
      (store as any).metadata = value;
    }),
    setGeoJson: vi.fn((value: unknown) => {
      (store as any).geoJson = value;
      (store as any).hasGeoJson = value != null;
    }),
    setTemporalRange: vi.fn((value: [number, number]) => {
      (store as any).temporalRange = value;
      (store as any).temporalRangeMin = value[0];
      (store as any).temporalRangeMax = value[1];
    }),
    setTimeSeriesLoading: vi.fn(),
    setTimeSeriesLoaded: vi.fn(),
    setTimeSeriesNoArea: vi.fn(),
    setTimeSeries: vi.fn(),
    setAreaSummary: vi.fn(),
    clearTimeSeriesData: vi.fn(),
    setTimeSeriesBadRequest: vi.fn(),
    setTimeSeriesServerError: vi.fn(),
    setTimeSeriesTimeout: vi.fn(),
    filteredTimeSeries: vi.fn(() => ({
      x: [1, 2, 3],
      y: [10, 20, 30],
      name: "Original",
    })),
  });

  Object.assign(store, overrides);
  return store;
}

export function createAppStore(overrides: Record<string, unknown> = {}) {
  const store = reactive({
    isFirstVisit: true,
    setVisited: vi.fn(() => {
      (store as any).isFirstVisit = false;
    }),
  });

  Object.assign(store, overrides);
  return store;
}

export function createAnalysisStore(overrides: Record<string, unknown> = {}) {
  const store = reactive({
    formDrafts: {} as Record<string, unknown>,
    requestData: null as unknown,
    response: null as unknown,
    summaryStatistics: [] as unknown[],
    timeseries: [] as unknown[],
    setDefaultRequestData: vi.fn((value: unknown) => {
      (store as any).requestData = value;
    }),
    setRequestData: vi.fn((value: unknown) => {
      (store as any).requestData = value;
    }),
    setResponse: vi.fn((value: any) => {
      (store as any).response = value;
      (store as any).summaryStatistics = value.summary_stats ?? [];
      (store as any).timeseries =
        value.series?.map((series: any) => ({
          name: series.options?.name ?? "Series",
          x: [1, 2, 3],
          y: series.values,
        })) ?? [];
    }),
    clear: vi.fn(),
  });

  Object.assign(store, overrides);
  return store;
}
