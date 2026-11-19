import type {
  TimeseriesRequest,
  TimeseriesResponse,
  TimeRange,
} from "@/types/timeseries";

export type SuccessfulJobStatus = {
  status: "SUCCESS";
  result: TimeseriesResponse;
  error?: string | null;
};
export type AnalysisOptions = Pick<
  TimeseriesRequest,
  | "zonal_statistic"
  | "transform"
  | "requested_series_options"
  | "max_processing_time"
>;
export type DraftTimeseriesRequest = Omit<
  TimeseriesRequest,
  "dataset_id" | "variable_id" | "selected_area"
> & {
  dataset_id: string | undefined;
  variable_id: string | null;
  selected_area: unknown;
};
export type SavedAnalysisRequest = TimeseriesRequest & {
  time_range: TimeRange;
};

export function defaultAnalysisOptions(): AnalysisOptions {
  return {
    zonal_statistic: "mean",
    transform: { type: "NoTransform" },
    requested_series_options: [
      { name: "Original", smoother: { type: "NoSmoother" } },
    ],
    max_processing_time: 20000,
  };
}
