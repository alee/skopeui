import type { TimeseriesRequest, TimeRange } from "@/types/timeseries";
import type { AnalysisFormDraft, TransformOptionId } from "@/types/analysis";
import type { AnalysisOptions } from "@/types/api";
import { extractYear, toISODate } from "@/utils/stats";

const DEFAULT_CENTERED_SMOOTHING_WIDTH = 11;
export const SMOOTHING_OPTIONS = [
  { label: "None (time steps individually plotted)", id: "none" },
  { label: "Centered Running Average", id: "centeredAverage" },
  { label: "Trailing Running Average (- window width)", id: "trailingAverage" },
] as const;
export const TRANSFORM_OPTIONS = [
  { label: "None: Modeled values displayed", id: "none" },
  { label: "Z-Score wrt selected interval", id: "zscoreSelected" },
  { label: "Z-Score wrt fixed interval", id: "zscoreFixed" },
  { label: "Z-Score wrt moving interval", id: "zscoreMoving" },
] as const;

export function defaultAnalysisForm(): AnalysisFormDraft {
  return {
    zonalStatistic: "mean",
    smoothingOption: "none",
    smoothingTimeStep: DEFAULT_CENTERED_SMOOTHING_WIDTH,
    transformOption: "none",
    zScoreMovingIntervalTimeSteps: 25,
    timeRange: { lb: { year: 1500, month: 1 }, ub: { year: 1800, month: 1 } },
  };
}

export function transformOptionFor(
  transform: TimeseriesRequest["transform"],
  range?: TimeRange | null,
): TransformOptionId {
  if (transform.type === "NoTransform") return "none";
  if (transform.type === "ZScoreMovingInterval") return "zscoreMoving";
  const reference = transform.time_range;
  // Legacy saved requests omitted the selected interval's reference.
  if (
    !reference ||
    (range &&
      extractYear(reference.gte) === extractYear(range.gte) &&
      extractYear(reference.lte) === extractYear(range.lte))
  )
    return "zscoreSelected";
  return "zscoreFixed";
}

export function analysisOptionsFromForm(
  form: AnalysisFormDraft,
  range: [number, number],
): Pick<
  AnalysisOptions,
  "zonal_statistic" | "transform" | "requested_series_options"
> {
  let transform: TimeseriesRequest["transform"] = { type: "NoTransform" };
  switch (form.transformOption) {
    case "zscoreMoving":
      transform = {
        type: "ZScoreMovingInterval",
        width: Number(form.zScoreMovingIntervalTimeSteps),
      };
      break;
    case "zscoreSelected":
    case "zscoreFixed": {
      const [start, end] =
        form.transformOption === "zscoreSelected"
          ? range
          : [Number(form.timeRange.lb.year), Number(form.timeRange.ub.year)];
      transform = {
        type: "ZScoreFixedInterval",
        time_range: { gte: toISODate(start), lte: toISODate(end) },
      };
      break;
    }
  }
  const series: TimeseriesRequest["requested_series_options"] = [
    {
      name: form.transformOption === "none" ? "Original" : "Transformed",
      smoother: { type: "NoSmoother" },
    },
  ];
  if (form.smoothingOption !== "none")
    series.push({
      name: "Smoothed",
      smoother: {
        type: "MovingAverageSmoother",
        method:
          form.smoothingOption === "centeredAverage" ? "centered" : "trailing",
        width: Number(form.smoothingTimeStep),
      },
    });
  return {
    zonal_statistic: form.zonalStatistic,
    transform,
    requested_series_options: series,
  };
}

export function analysisFormFromRequest(
  draft: AnalysisFormDraft,
  request: Partial<
    Pick<
      TimeseriesRequest,
      | "zonal_statistic"
      | "transform"
      | "requested_series_options"
      | "time_range"
    >
  >,
): AnalysisFormDraft {
  const form = {
    ...draft,
    timeRange: { lb: { ...draft.timeRange.lb }, ub: { ...draft.timeRange.ub } },
  };
  form.zonalStatistic = request.zonal_statistic ?? form.zonalStatistic;
  if (request.requested_series_options) {
    const smoother = request.requested_series_options.find(
      (series) => series.name === "Smoothed",
    )?.smoother;
    form.smoothingOption =
      smoother?.type === "MovingAverageSmoother"
        ? smoother.method === "centered"
          ? "centeredAverage"
          : "trailingAverage"
        : "none";
    if (smoother?.type === "MovingAverageSmoother")
      form.smoothingTimeStep = smoother.width;
  }
  const transform = request.transform;
  if (transform) {
    form.transformOption = transformOptionFor(transform, request.time_range);
    if (transform.type === "ZScoreMovingInterval")
      form.zScoreMovingIntervalTimeSteps = transform.width;
    if (
      form.transformOption === "zscoreFixed" &&
      transform.type === "ZScoreFixedInterval" &&
      transform.time_range
    ) {
      form.timeRange = {
        lb: { year: extractYear(transform.time_range.gte), month: 1 },
        ub: { year: extractYear(transform.time_range.lte), month: 1 },
      };
    }
  }
  return form;
}
