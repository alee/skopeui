import type { SavedAnalysisRequest } from "@/types/api";

export function buildReadme(
  requestData: SavedAnalysisRequest,
  buildId: string,
) {
  return `
# SKOPE data for ${requestData.dataset_id} / ${requestData.variable_id}
### [version: ${buildId}](https://github.com/openskope/skopeui)

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
- \`plot.png\` and \`plot.svg\` - Graph of the time series data.
- \`time-series.json\` and \`time-series.csv\` - time series data in JSON and long form CSV formats.
- \`study-area.geojson\` - GeoJSON file with the defined study area.
`;
}
