import { expect, it } from "vitest";
import { captureAnalysisExport } from "@/utils/analysisExport";
import { defaultAnalysisOptions, type SavedAnalysisRequest } from "@/types/api";
import { timeSeriesResponseFixture } from "@/tests/fixtures/page-fixtures";

it("captures full precision, nulls, and a detached request and response", () => {
  const request: SavedAnalysisRequest = {
    ...defaultAnalysisOptions(),
    dataset_id: "paleocar",
    variable_id: "tasmax",
    selected_area: { type: "Point", coordinates: [-108, 37] },
    time_range: { gte: "0001", lte: "0003" },
  };
  const response = JSON.parse(JSON.stringify(timeSeriesResponseFixture));
  response.summary_stats = [
    {
      name: "Original",
      mean: 1.23456789012345,
      median: null,
      stdev: 0.000000123,
    },
  ];
  response.series[0].values = [1.23456789012345, null, 3];
  const snapshot = captureAnalysisExport(request, response);
  request.selected_area = { type: "Point", coordinates: [0, 0] };
  response.summary_stats[0].mean = 100;
  response.series[0].values[0] = 100;
  expect(snapshot.summaryStatistics).toEqual([
    {
      name: "Original",
      mean: 1.23456789012345,
      median: null,
      stdev: 0.000000123,
    },
  ]);
  expect(snapshot.traces[0]!.y).toEqual([1.23456789012345, null, 3]);
  expect(snapshot.rows[1]).toEqual({ name: "Original", x: 2, y: null });
  expect(snapshot.request.selected_area).toEqual({
    type: "Point",
    coordinates: [-108, 37],
  });
});
