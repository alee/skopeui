import { API_HOST_URL, BUILD_ID } from "@/store/modules/_constants";
import { extractYear, toISODate } from "@/store/stats";

export const DEFAULT_CENTERED_SMOOTHING_WIDTH = 11;
export const DEFAULT_MAX_PROCESSING_TIME = 20000; // in ms
export const METADATA_ENDPOINT = `${API_HOST_URL}/metadata`;
export const TILES_ENDPOINT = `${API_HOST_URL}/tiles`;
export const TIMESERIES_SUBMIT_ENDPOINT = `${API_HOST_URL}/timeseries/extract`;
export const TIMESERIES_STATUS_ENDPOINT = `${API_HOST_URL}/timeseries/status`;
export const TIMESERIES_REFINE_ENDPOINT = `${API_HOST_URL}/timeseries/analyze`;
export function buildReadme(requestData) {
  return `
# SKOPE data for ${requestData.dataset_id} / ${requestData.variable_id}
### [version: ${BUILD_ID}](https://github.com/openskope/skopeui)

## Terms of Service
By using the SKOPE application, you assume any risk associated with its use. You are solely responsible for any damage or loss you may incur resulting from your reliance on or use of information provided by SKOPE.

## Citation
Use of data, graphics, or other information provided by SKOPE should be accompanied by a citation of the original data source (provided by SKOPE in the dataset metadata) and of the SKOPE application Web page. Example reference: (SKOPE 2021).

Example Citation:
> SKOPE 2021 SKOPE: Synthesizing Knowledge of Past Environments. https://app.openskope.org/. Accessed 1 July 2021.

## Contact
For comments, feedback, or questions, please use the "Email Us" button on the application navigation bar or send us a note at skope-team@googlegroups.com

Time range: ${requestData.time_range.gte} - ${requestData.time_range.lte} CE
Location: ${JSON.stringify(requestData.selected_area, null, 2)}

## Files
- \`skope-request.json\` - A plaintext JSON file with all input parameters needed to recreate this analysis. Load this file into the SKOPE app to regenerate the data in this zipfile.
- \`summary-statistics.json\` - The computed mean, median, and standard deviation of the time series data.
- \`plot.png\` and \`plog.svg\` - Graph of the time series data.
- \`time-series.json\` and \`time-series.csv\` - time series data in JSON and long form CSV formats.
- \`study-area.geojson\` - GeoJSON file with the defined study area.
`;
}

// constants data structure of available smoothing options to present in the UI
export const SMOOTHING_OPTIONS = [
  {
    label: "None (time steps individually plotted)",
    id: "none",
    type: "NoSmoother",
    method: "none",
    toRequestData: function (analyzeVue) {
      return {
        type: this.type,
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
        type: this.type,
        method: this.method,
        width: analyzeVue.smoothingTimeStep,
      };
    },
    fromRequestData: function (analyzeVue, requestData) {
      analyzeVue.smoothingOption = this.id;
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
        type: this.type,
        method: this.method,
        width: analyzeVue.smoothingTimeStep,
      };
    },
    fromRequestData: function (analyzeVue, requestData) {
      analyzeVue.smoothingOption = this.id;
      analyzeVue.smoothingTimeStep = requestData.width;
    },
  },
];

function sameYears(a, b) {
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
export const TRANSFORM_OPTIONS = [
  {
    label: "None: Modeled values displayed",
    id: "none",
    type: "NoTransform",
    matches: function (transform) {
      return transform.type === this.type;
    },
    toRequestData: function () {
      return {
        type: this.type,
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
        transform.type === this.type &&
        (transform.time_range == null ||
          sameYears(transform.time_range, timeRange))
      );
    },
    toRequestData: function (analyzeVue) {
      // The API's reference defaults to the whole stored extraction, which
      // need not be the range on screen, so send the range explicitly.
      return {
        type: this.type,
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
        transform.type === this.type &&
        transform.time_range != null &&
        !sameYears(transform.time_range, timeRange)
      );
    },
    toRequestData: function (analyzeVue) {
      return {
        type: this.type,
        time_range: {
          gte: toISODate(analyzeVue.timeRange.lb.year),
          lte: toISODate(analyzeVue.timeRange.ub.year),
        },
      };
    },
    fromRequestData: function (analyzeVue, requestData) {
      // The form edits years; the request carries ISO dates or keys.
      analyzeVue.transformOption = this.id;
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
        type: this.type,
        width: analyzeVue.zScoreMovingIntervalTimeSteps,
      };
    },
    fromRequestData: function (analyzeVue, requestData) {
      analyzeVue.transformOption = this.id;
      analyzeVue.zScoreMovingIntervalTimeSteps = requestData.width;
    },
  },
];
