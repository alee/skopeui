import type {
  SeriesOptions,
  TimeseriesRequest,
  TimeRange,
} from "@/types/timeseries";
import { extractYear, toISODate } from "@/utils/stats";

export const DEFAULT_CENTERED_SMOOTHING_WIDTH = 11;

type Transform = TimeseriesRequest["transform"];
type Smoother = SeriesOptions["smoother"];

export interface AnalysisOptionForm {
  smoothingOption: string;
  smoothingTimeStep: number;
  transformOption: string;
  temporalRange: number[];
  timeRange: {
    lb: { year: number; month: number };
    ub: { year: number; month: number };
  };
  zScoreMovingIntervalTimeSteps: number;
}

interface SmoothingOption {
  label: string;
  id: string;
  type: Smoother["type"];
  method: "none" | "centered" | "trailing";
  toRequestData(form: AnalysisOptionForm): Smoother;
  fromRequestData(form: AnalysisOptionForm, request: Smoother): void;
}

interface TransformOption {
  label: string;
  id: string;
  type: Transform["type"];
  matches(transform: Transform, timeRange?: TimeRange | null): boolean;
  toRequestData(form: AnalysisOptionForm): Transform;
  fromRequestData(form: AnalysisOptionForm, request: Transform): void;
}

// constants data structure of available smoothing options to present in the UI
export const SMOOTHING_OPTIONS: SmoothingOption[] = [
  {
    label: "None (time steps individually plotted)",
    id: "none",
    type: "NoSmoother",
    method: "none",
    toRequestData: function (analyzeVue) {
      return {
        type: "NoSmoother",
      };
    },
    fromRequestData: function (analyzeVue, requestData) {
      analyzeVue.smoothingOption = this.id;
    },
  },
  {
    label: "Centered Running Average",
    id: "centeredAverage",
    method: "centered",
    type: "MovingAverageSmoother",
    toRequestData: function (analyzeVue) {
      return {
        type: "MovingAverageSmoother",
        method: "centered",
        width: analyzeVue.smoothingTimeStep,
      };
    },
    fromRequestData: function (analyzeVue, requestData) {
      analyzeVue.smoothingOption = this.id;
      if (requestData.type === "MovingAverageSmoother")
        analyzeVue.smoothingTimeStep = requestData.width;
    },
  },
  {
    label: "Trailing Running Average (- window width)",
    id: "trailingAverage",
    method: "trailing",
    type: "MovingAverageSmoother",
    toRequestData: function (analyzeVue) {
      return {
        type: "MovingAverageSmoother",
        method: "trailing",
        width: analyzeVue.smoothingTimeStep,
      };
    },
    fromRequestData: function (analyzeVue, requestData) {
      analyzeVue.smoothingOption = this.id;
      if (requestData.type === "MovingAverageSmoother")
        analyzeVue.smoothingTimeStep = requestData.width;
    },
  },
];

function sameYears(
  a: TimeRange | null | undefined,
  b: TimeRange | null | undefined,
) {
  if (a == null || b == null) return false;
  return (
    extractYear(a.gte) === extractYear(b.gte) &&
    extractYear(a.lte) === extractYear(b.lte)
  );
}

// constants data structure for available transform options to display in the UI.
// matches(transform, timeRange) picks the option a request's transform came
// from, given the request's own time range. Two options send
// ZScoreFixedInterval: "selected" uses the request's range as its reference,
// "fixed" a range the user typed.
export const TRANSFORM_OPTIONS: TransformOption[] = [
  {
    label: "None: Modeled values displayed",
    id: "none",
    type: "NoTransform",
    matches: function (transform) {
      return transform.type === this.type;
    },
    toRequestData: function () {
      return {
        type: "NoTransform",
      };
    },
    fromRequestData: function (analyzeVue) {
      analyzeVue.transformOption = this.id;
    },
  },
  {
    label: "Z-Score wrt selected interval",
    id: "zscoreSelected",
    type: "ZScoreFixedInterval",
    matches: function (transform, timeRange) {
      // Requests saved before the reference was sent carry none.
      return (
        transform.type === "ZScoreFixedInterval" &&
        (transform.time_range == null ||
          sameYears(transform.time_range, timeRange))
      );
    },
    toRequestData: function (analyzeVue) {
      // The API's reference defaults to the whole stored extraction, which
      // need not be the range on screen, so send the range explicitly.
      return {
        type: "ZScoreFixedInterval",
        time_range: {
          gte: toISODate(analyzeVue.temporalRange[0]),
          lte: toISODate(analyzeVue.temporalRange[1]),
        },
      };
    },
    fromRequestData: function (analyzeVue) {
      analyzeVue.transformOption = this.id;
    },
  },
  {
    label: "Z-Score wrt fixed interval",
    id: "zscoreFixed",
    type: "ZScoreFixedInterval",
    matches: function (transform, timeRange) {
      return (
        transform.type === "ZScoreFixedInterval" &&
        transform.time_range != null &&
        !sameYears(transform.time_range, timeRange)
      );
    },
    toRequestData: function (analyzeVue) {
      return {
        type: "ZScoreFixedInterval",
        time_range: {
          gte: toISODate(analyzeVue.timeRange.lb.year),
          lte: toISODate(analyzeVue.timeRange.ub.year),
        },
      };
    },
    fromRequestData: function (analyzeVue, requestData) {
      // The form edits years; the request carries ISO dates or keys.
      analyzeVue.transformOption = this.id;
      if (requestData.type !== "ZScoreFixedInterval" || !requestData.time_range)
        return;
      analyzeVue.timeRange = {
        lb: { year: extractYear(requestData.time_range.gte), month: 1 },
        ub: { year: extractYear(requestData.time_range.lte), month: 1 },
      };
    },
  },
  {
    label: "Z-Score wrt moving interval",
    id: "zscoreMoving",
    type: "ZScoreMovingInterval",
    matches: function (transform) {
      return transform.type === this.type;
    },
    toRequestData: function (analyzeVue) {
      return {
        type: "ZScoreMovingInterval",
        width: analyzeVue.zScoreMovingIntervalTimeSteps,
      };
    },
    fromRequestData: function (analyzeVue, requestData) {
      analyzeVue.transformOption = this.id;
      if (requestData.type === "ZScoreMovingInterval")
        analyzeVue.zScoreMovingIntervalTimeSteps = requestData.width;
    },
  },
];
