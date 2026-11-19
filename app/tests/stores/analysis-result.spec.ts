import { beforeEach, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAnalysisStore } from "@/stores/analysis";
import { useDatasetStore } from "@/stores/dataset";
import { parseTimeseriesRequest } from "@/utils/savedAnalysis";
import metadata from "@/tests/fixtures/metadata-1.0.0.json";
import { timeSeriesResponseFixture } from "@/tests/fixtures/page-fixtures";

beforeEach(() => setActivePinia(createPinia()));

it("makes only a completed result for the current request available to export", () => {
  const dataset = useDatasetStore();
  dataset.setMetadata(metadata.datasets[0] as any);
  dataset.setGeoJson({ type: "Point", coordinates: [-108, 37] });
  const store = useAnalysisStore();
  store.setDefaultRequestData(dataset.defaultApiRequestData);
  const request = parseTimeseriesRequest(store.requestData);
  store.setResponse(timeSeriesResponseFixture, request);
  expect(store.hasCurrentResult).toBe(false);
  dataset.setTimeSeriesLoaded();
  expect(store.hasCurrentResult).toBe(true);
  store.setRequestData({ ...request, zonal_statistic: "median" });
  expect(store.hasCurrentResult).toBe(false);
  store.setRequestData(request);
  dataset.setTimeSeriesLoading();
  expect(store.hasCurrentResult).toBe(false);
  dataset.setTimeSeriesServerError([{ msg: "failed" }]);
  expect(store.hasCurrentResult).toBe(false);
  dataset.setTimeSeriesLoaded();
  expect(store.hasCurrentResult).toBe(true);
  store.clear();
  expect(store.completedRequest).toBeNull();
  expect(store.hasCurrentResult).toBe(false);
});
