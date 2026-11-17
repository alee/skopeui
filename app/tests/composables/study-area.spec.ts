import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import { useStudyArea } from "@/composables/useStudyArea";
import { useExtractionStore } from "@/stores/extraction";
import { useAnalysisStore } from "@/stores/analysis";
import metadataFixture from "@/tests/fixtures/metadata-1.0.0.json";
import type { Dataset } from "@/types/metadata";
import { useDatasetStore } from "@/stores/dataset";

const area = {
  type: "Feature",
  properties: {},
  geometry: { type: "Point", coordinates: [-108.5, 37] },
};

function withResults() {
  const dataset = useDatasetStore();
  const analysis = useAnalysisStore();
  dataset.setGeoJson({ type: "Point", coordinates: [0, 0] });
  useExtractionStore().jobIds["old-area"] = "old-job";
  dataset.setTimeSeries({
    timeSeries: { x: [103], y: [1] },
    numberOfCells: 1,
    area: 0,
  });
  dataset.setTimeSeriesLoaded();
  analysis.setResponse({
    summary_stats: [{ name: "Original", mean: 1, median: 1, stdev: 0 }],
    series: [
      { timesteps: ["0103"], values: [1], options: { name: "Original" } },
    ],
  });
  return { dataset, analysis };
}

describe("changing the study area", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it("drops the old area's plots, statistics and extractions", () => {
    const { dataset, analysis } = withResults();

    useStudyArea().save(area);

    expect(useExtractionStore().jobIds).toEqual({});
    expect(dataset.hasData).toBe(false);
    expect(dataset.timeSeriesRequestStatus.status).not.toBe("success");
    expect(analysis.timeseries).toEqual([]);
    expect(analysis.summaryStatistics).toEqual([]);
  });

  it("drops them when the area is cleared too", () => {
    const { dataset, analysis } = withResults();

    useStudyArea().clear();

    expect(useExtractionStore().jobIds).toEqual({});
    expect(dataset.hasData).toBe(false);
    expect(analysis.timeseries).toEqual([]);
  });
});

describe("study-area persistence", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    useDatasetStore().setMetadata(metadataFixture.datasets[0] as Dataset);
  });

  it("saves the current dataset's area to storage and state", () => {
    useStudyArea().save(area);
    expect(useDatasetStore().geoJson).toEqual(area);
    expect(JSON.parse(localStorage.getItem("geojson:paleocar_v3")!)).toEqual(
      area,
    );
  });

  it("restores only the active dataset's persisted area", () => {
    localStorage.setItem(
      "geojson:other",
      JSON.stringify({ type: "Point", coordinates: [0, 0] }),
    );
    useStudyArea().restore();
    expect(useDatasetStore().geoJson).toBeNull();
    localStorage.setItem("geojson:paleocar_v3", JSON.stringify(area));
    useStudyArea().restore();
    expect(useDatasetStore().geoJson).toEqual(area);
  });

  it("keeps a transient active area instead of replacing it with the persisted one", () => {
    localStorage.setItem("geojson:paleocar_v3", JSON.stringify(area));
    const transient = { type: "Point", coordinates: [1, 2] };
    useDatasetStore().setGeoJson(transient);
    useStudyArea().restore();
    expect(useDatasetStore().geoJson).toEqual(transient);
  });

  it("clears current state and storage while keeping another dataset's saved area", () => {
    useStudyArea().save(area);
    localStorage.setItem("geojson:other", JSON.stringify(area));
    useStudyArea().clear();
    expect(useDatasetStore().geoJson).toBeNull();
    expect(localStorage.getItem("geojson:paleocar_v3")).toBeNull();
    expect(JSON.parse(localStorage.getItem("geojson:other")!)).toEqual(area);
  });
});
