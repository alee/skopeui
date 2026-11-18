import type { SavedAnalysisRequest } from "@/types/api";
import type { TimeseriesResponse } from "@/types/timeseries";
import { yearOfTimestep } from "@/utils/timeAxis";

/** Detached inputs for every file in an archive; no live store reads after capture. */
export function captureAnalysisExport(
  request: SavedAnalysisRequest,
  response: TimeseriesResponse,
) {
  const snapshot = JSON.parse(JSON.stringify({ request, response })) as {
    request: SavedAnalysisRequest;
    response: TimeseriesResponse;
  };
  const traces = snapshot.response.series.map((series) => ({
    x: series.timesteps.map(yearOfTimestep),
    y: series.values,
    name: series.options.name,
    type: "scatter" as const,
  }));
  return {
    request: snapshot.request,
    summaryStatistics: snapshot.response.summary_stats,
    traces,
    rows: traces.flatMap((trace) =>
      trace.x.map((x, i) => ({ name: trace.name, x, y: trace.y[i] })),
    ),
  };
}
