import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import { useMessagesStore } from "@/stores/messages";
import { useStudyArea } from "@/composables/useStudyArea";
import { useExtractionStore } from "@/stores/extraction";
import { timeSeriesResponseFixture } from "@/tests/fixtures/page-fixtures";
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
    ...timeSeriesResponseFixture,
    summary_stats: [{ name: "Original", mean: 1, median: 1, stdev: 0 }],
    series: [
      {
        time_range: { gte: "0103", lte: "0103" },
        timesteps: ["0103"],
        values: [1],
        options: { name: "Original", smoother: { type: "NoSmoother" } },
      },
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

  it.each([
    {},
    { type: "FeatureCollection", features: [] },
    { type: "Feature", geometry: null },
  ])(
    "ignores stale empty persisted areas without deleting the saved value: %j",
    (invalid) => {
      localStorage.setItem("geojson:paleocar_v3", JSON.stringify(invalid));
      useStudyArea().restore();
      expect(useDatasetStore().hasGeoJson).toBe(false);
      expect(useDatasetStore().geoJson).toBeNull();
      expect(JSON.parse(localStorage.getItem("geojson:paleocar_v3")!)).toEqual(
        invalid,
      );
    },
  );

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

describe("unavailable browser storage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    useDatasetStore().setMetadata(metadataFixture.datasets[0] as Dataset);
  });
  afterEach(() => vi.restoreAllMocks());

  it("continues editing when access is blocked, retaining changes across dataset switches", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    const studyArea = useStudyArea();
    const dataset = useDatasetStore();
    studyArea.restore();
    studyArea.save(area);
    expect(dataset.geoJson).toEqual(area);
    const original = dataset.metadata!;
    dataset.setMetadata({ ...original, id: "other" });
    dataset.setMetadata(original);
    studyArea.restore();
    expect(dataset.geoJson).toEqual(area);
    expect(useMessagesStore().messages).toEqual([
      {
        type: "warning",
        message: expect.stringContaining("Browser storage is unavailable"),
      },
    ]);
  });

  it("keeps a cleared area cleared when storage still contains the old value", () => {
    const studyArea = useStudyArea();
    studyArea.save(area);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    studyArea.clear();
    studyArea.restore();
    expect(useDatasetStore().geoJson).toBeNull();
    expect(localStorage.getItem(useDatasetStore().geoJsonKey)).not.toBeNull();
    expect(useMessagesStore().messages).toHaveLength(1);
  });

  it("retains the new area when writes exceed quota, then removes the override after a successful save", () => {
    const studyArea = useStudyArea();
    const write = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Full", "QuotaExceededError");
      });
    studyArea.save(area);
    const dataset = useDatasetStore();
    expect(dataset.geoJson).toEqual(area);
    expect(dataset.unpersistedStudyAreas[dataset.geoJsonKey]).toEqual(area);
    write.mockRestore();
    studyArea.save(area);
    expect(dataset.unpersistedStudyAreas).toEqual({});
    expect(JSON.parse(localStorage.getItem(dataset.geoJsonKey)!)).toEqual(area);
  });
});
