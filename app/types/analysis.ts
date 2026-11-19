import type { TimeseriesRequest } from "@/types/timeseries";

export type SmoothingOptionId = "none" | "centeredAverage" | "trailingAverage";
export type TransformOptionId =
  "none" | "zscoreSelected" | "zscoreFixed" | "zscoreMoving";
// Inputs retain their raw drafts; normalize only when constructing a request.
export interface AnalysisFormDraft {
  zonalStatistic: TimeseriesRequest["zonal_statistic"];
  smoothingOption: SmoothingOptionId;
  smoothingTimeStep: number | string;
  transformOption: TransformOptionId;
  zScoreMovingIntervalTimeSteps: number | string;
  timeRange: {
    lb: { year: number | string; month: number };
    ub: { year: number | string; month: number };
  };
}
