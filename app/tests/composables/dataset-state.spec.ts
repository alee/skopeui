import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useDatasetStore } from "@/stores/dataset";
import { useAnalysisStore } from "@/stores/analysis";
import { useExtractionStore } from "@/stores/extraction";
import { useDatasetMetadata } from "@/composables/useDatasetMetadata";
import type { Dataset } from "@/types/metadata";
import metadataFixture from "@/tests/fixtures/metadata-1.0.0.json";

const paleocar = metadataFixture.datasets[0] as Dataset;
const area = { type: "Point", coordinates: [-108.5, 37] };
const other: Dataset = {
  ...paleocar,
  id: "other",
  default_variable: "other-variable",
  variables: [{ ...paleocar.variables[0], id: "other-variable" }],
  time: { ...paleocar.time, origin: "1500", end: "1900", count: 401 },
};

function withResults() {
  const dataset = useDatasetStore();
  dataset.setMetadata(paleocar);
  dataset.setGeoJson(area);
  dataset.setTemporalRange([1500, 1600]);
  dataset.setTimeSeries({
    timeSeries: { x: [1500], y: [42] },
    area: 1e6,
    numberOfCells: 2,
  });
  dataset.setTimeSeriesLoaded();
  const analysis = useAnalysisStore();
  analysis.setRequestData({
    zonal_statistic: "median",
    transform: { type: "NoTransform" },
  });
  analysis.setResponse({
    series: [
      { timesteps: ["1500"], values: [42], options: { name: "Original" } },
    ],
    summary_stats: [{ name: "Original", mean: 42, median: 42, stdev: 0 }],
  });
  const extraction = useExtractionStore();
  extraction.jobIds.old = "old-job";
  return { dataset, analysis, extraction };
}

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("authoritative selection state", () => {
  it("derives readiness immediately when variables, metadata and geometry change", () => {
    const dataset = useDatasetStore();
    dataset.setMetadata(paleocar);
    expect(dataset.canHandleTimeSeriesRequest).toBe(false);
    dataset.setGeoJson(area);
    expect(dataset.canHandleTimeSeriesRequest).toBe(true);
    dataset.setVariable(null);
    expect(dataset.canHandleTimeSeriesRequest).toBe(false);
    dataset.setVariable("ppt_annual");
    expect(dataset.canHandleTimeSeriesRequest).toBe(true);
    dataset.clearGeoJson();
    expect(dataset.hasGeoJson).toBe(false);
    expect(dataset.canHandleTimeSeriesRequest).toBe(false);
    dataset.setMetadata(null);
    expect(dataset.variable.id).toBeNull();
  });

  it("does not retain the previous variable for an unknown selection", () => {
    const { dataset, analysis } = withResults();
    dataset.setVariable("missing");
    expect(dataset.variable.id).toBeNull();
    expect(dataset.canHandleTimeSeriesRequest).toBe(false);
    expect(dataset.timeSeriesRequestData.variable_id).toBeNull();
    expect(dataset.hasData).toBe(false);
    expect(analysis.timeseries).toEqual([]);
  });

  it("does not silently select another variable if the active one disappears on refresh", () => {
    const { dataset } = withResults();
    const variables = paleocar.variables.filter(
      (variable) => variable.id !== dataset.variable.id,
    );
    dataset.setMetadata({
      ...paleocar,
      default_variable: variables[0].id,
      variables,
    });
    expect(dataset.variable.id).toBeNull();
    expect(dataset.canHandleTimeSeriesRequest).toBe(false);
    expect(dataset.hasData).toBe(false);
  });

  it("derives both requests and range bounds from the current selection", () => {
    const { dataset, analysis } = withResults();
    dataset.setVariable("gdd_cotton_annual");
    dataset.setTemporalRange([1700, 1800]);
    const current = {
      dataset_id: paleocar.id,
      variable_id: "gdd_cotton_annual",
      selected_area: area,
      time_range: { gte: "1700-01-01", lte: "1800-01-01" },
    };
    expect(dataset.temporalRangeMin).toBe(1700);
    expect(dataset.temporalRangeMax).toBe(1800);
    expect(dataset.timeSeriesRequestData).toMatchObject(current);
    expect(analysis.requestData).toMatchObject({
      ...current,
      zonal_statistic: "median",
    });
    expect(dataset.minYear).toBe(103);
    expect(dataset.maxYear).toBe(2000);
  });

  it("stores analysis choices without letting stale source fields override the active selection", () => {
    const { dataset, analysis } = withResults();
    analysis.setRequestData({
      dataset_id: "stale",
      variable_id: "stale",
      selected_area: null,
      time_range: { gte: "0001", lte: "0002" },
      zonal_statistic: "median",
    });
    expect(analysis.requestData).toMatchObject({
      ...dataset.defaultApiRequestData,
      zonal_statistic: "median",
    });
    dataset.setGeoJson({ type: "Point", coordinates: [0, 0] });
    expect(analysis.requestData.selected_area).toEqual(dataset.geoJson);
  });

  it("reads variable presentation from refreshed metadata while preserving the user's range and results", () => {
    const { dataset } = withResults();
    const variable = dataset.variable.id;
    dataset.setMetadata({
      ...paleocar,
      variables: paleocar.variables.map((v) => ({ ...v, title: "New title" })),
    });
    expect(dataset.variable.id).toBe(variable);
    expect(dataset.variable.title).toBe("New title");
    expect(dataset.temporalRange).toEqual([1500, 1600]);
    expect(dataset.hasData).toBe(true);
  });
});

describe("selection transitions", () => {
  it("clears results and retires jobs when geometry changes directly", () => {
    const { dataset, analysis, extraction } = withResults();
    dataset.setGeoJson({ type: "Point", coordinates: [0, 0] });
    expect(dataset.hasData).toBe(false);
    expect(dataset.numberOfCells).toBe(0);
    expect(analysis.timeseries).toEqual([]);
    expect(analysis.summaryStatistics).toEqual([]);
    expect(extraction.jobIds).toEqual({});
  });

  it("clears variable-specific results while retaining reusable extractions", () => {
    const { dataset, analysis, extraction } = withResults();
    dataset.setVariable("gdd_cotton_annual");
    expect(dataset.hasData).toBe(false);
    expect(analysis.timeseries).toEqual([]);
    expect(extraction.jobIds.old).toBe("old-job");
  });

  it("clears analysis summaries when the range changes without discarding extraction jobs", () => {
    const { dataset, analysis, extraction } = withResults();
    dataset.setTemporalRange([1600, 1700]);
    expect(analysis.summaryStatistics).toEqual([]);
    expect(extraction.jobIds.old).toBe("old-job");
  });

  it.each(["release_id", "declaration_digest"] as const)(
    "invalidates results and jobs when %s changes",
    (field) => {
      const { dataset, analysis, extraction } = withResults();
      dataset.setMetadata({ ...paleocar, [field]: "changed" });
      expect(dataset.geoJson).toEqual(area);
      expect(dataset.temporalRange).toEqual([103, 2000]);
      expect(dataset.hasData).toBe(false);
      expect(analysis.timeseries).toEqual([]);
      expect(extraction.jobIds).toEqual({});
    },
  );

  it("switches datasets without carrying geometry or variable state across", () => {
    const { dataset, analysis, extraction } = withResults();
    dataset.setMetadata(other);
    expect(dataset.geoJson).toBeNull();
    expect(dataset.variable.id).toBe("other-variable");
    expect(dataset.temporalRange).toEqual([1500, 1900]);
    expect(dataset.minYear).toBe(1500);
    expect(dataset.maxYear).toBe(1900);
    expect(dataset.canHandleTimeSeriesRequest).toBe(false);
    expect(dataset.hasData).toBe(false);
    expect(analysis.timeseries).toEqual([]);
    expect(extraction.jobIds).toEqual({});
  });

  it("preserves results and jobs when the same selection is reapplied", () => {
    const { dataset, analysis, extraction } = withResults();
    dataset.setMetadata(JSON.parse(JSON.stringify(paleocar)));
    dataset.setVariable(dataset.variable.id);
    dataset.setTemporalRange([1500, 1600]);
    dataset.setGeoJson({
      type: "Feature",
      geometry: area,
      properties: { label: "same area" },
    });
    expect(dataset.hasData).toBe(true);
    expect(analysis.summaryStatistics).toHaveLength(1);
    expect(extraction.jobIds.old).toBe("old-job");
  });
});

describe("initialization and persistence", () => {
  it("selects a different route variable without waiting for the background refresh", async () => {
    const { dataset } = withResults();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    await useDatasetMetadata().initializeDataset(
      paleocar.id,
      "gdd_cotton_annual",
    );
    expect(dataset.variable.id).toBe("gdd_cotton_annual");
    expect(dataset.hasData).toBe(false);
  });

  it("clears the previous selection while another dataset's metadata loads", async () => {
    const { dataset } = withResults();
    let respond!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            respond = resolve;
          }),
      ),
    );
    const pending = useDatasetMetadata().initializeDataset(other.id);
    expect(dataset.metadata).toBeNull();
    expect(dataset.geoJson).toBeNull();
    expect(dataset.hasData).toBe(false);
    expect(dataset.canHandleTimeSeriesRequest).toBe(false);
    respond(
      new Response(
        JSON.stringify({ ...metadataFixture, datasets: [paleocar, other] }),
      ),
    );
    await pending;
    expect(dataset.metadata?.id).toBe(other.id);
  });

  it("does not let an older metadata load replace the latest dataset selection", async () => {
    const replies: Array<(response: Response) => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            replies.push(resolve);
          }),
      ),
    );
    const first = useDatasetMetadata().initializeDataset(paleocar.id);
    const second = useDatasetMetadata().initializeDataset(other.id);
    const response = () =>
      new Response(
        JSON.stringify({ ...metadataFixture, datasets: [paleocar, other] }),
      );
    replies[1](response());
    await second;
    replies[0](response());
    await first;
    expect(useDatasetStore().metadata?.id).toBe(other.id);
  });

  it("restores the new dataset's own persisted area", async () => {
    const { dataset } = withResults();
    const otherArea = { type: "Point", coordinates: [1, 2] };
    localStorage.setItem("geojson:other", JSON.stringify(otherArea));
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              ...metadataFixture,
              datasets: [paleocar, other],
            }),
          ),
      ),
    );
    await useDatasetMetadata().initializeDataset(other.id);
    expect(dataset.geoJson).toEqual(otherArea);
    expect(dataset.geoJsonKey).toBe("geojson:other");
    expect(dataset.variable.id).toBe("other-variable");
    expect(dataset.canHandleTimeSeriesRequest).toBe(true);
  });

  it("updates the active release when metadata is refreshed", async () => {
    const { dataset, analysis, extraction } = withResults();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              ...metadataFixture,
              datasets: [{ ...paleocar, release_id: "r2" }],
            }),
          ),
      ),
    );
    await useDatasetMetadata().loadAllDatasetMetadata();
    expect(dataset.metadata?.release_id).toBe("r2");
    expect(dataset.hasData).toBe(false);
    expect(analysis.timeseries).toEqual([]);
    expect(extraction.jobIds).toEqual({});
  });
});
