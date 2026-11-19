import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSavedAnalysis } from "@/composables/useSavedAnalysis";
import { useDatasetStore } from "@/stores/dataset";
import { useMetadataStore } from "@/stores/metadata";
import { useAnalysisStore } from "@/stores/analysis";
import metadataFixture from "@/tests/fixtures/metadata-1.0.0.json";
import type { Dataset } from "@/types/metadata";

const request = {
  dataset_id: "paleocar_v3",
  variable_id: "gdd_cotton_annual",
  selected_area: { type: "Point", coordinates: [-108, 37] },
  time_range: { gte: "1500", lte: "1600" },
  zonal_statistic: "median",
  transform: { type: "NoTransform" },
  requested_series_options: [
    { name: "Original", smoother: { type: "NoSmoother" } },
  ],
};

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
  vi.stubGlobal("alert", vi.fn());
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(metadataFixture))),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("saved analysis restoration", () => {
  it("restores dataset, variable, range, geometry and options without overwriting the saved area", async () => {
    const previousArea = { type: "Point", coordinates: [0, 0] };
    localStorage.setItem("geojson:paleocar_v3", JSON.stringify(previousArea));
    await useSavedAnalysis().restore(request);
    const dataset = useDatasetStore();
    expect(dataset.metadata?.id).toBe(request.dataset_id);
    expect(dataset.variable.id).toBe(request.variable_id);
    expect(dataset.temporalRange).toEqual([1500, 1600]);
    expect(dataset.geoJson).toEqual(request.selected_area);
    expect(useAnalysisStore().requestData).toMatchObject({
      ...request,
      time_range: { gte: "1500-01-01", lte: "1600-01-01" },
    });
    expect(JSON.parse(localStorage.getItem("geojson:paleocar_v3")!)).toEqual(
      previousArea,
    );
  });

  it("rejects an unavailable variable before applying the imported selection", async () => {
    await expect(
      useSavedAnalysis().restore({ ...request, variable_id: "missing" }),
    ).rejects.toThrow("Unable to initialize");
    expect(useDatasetStore().geoJson).toBeNull();
    expect(useAnalysisStore().requestData).toEqual({});
  });

  it("rejects an unavailable dataset before applying the imported selection", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ...metadataFixture, datasets: [] })),
    );
    await expect(useSavedAnalysis().restore(request)).rejects.toThrow(
      "Unable to initialize",
    );
    expect(useDatasetStore().metadata).toBeNull();
    expect(useAnalysisStore().requestData).toEqual({});
  });

  it("does not apply an import whose metadata initialization was superseded", async () => {
    let reply!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            reply = resolve;
          }),
      ),
    );
    const pending = useSavedAnalysis().restore(request);
    const rejected = expect(pending).rejects.toThrow("Unable to initialize");
    const other = { ...metadataFixture.datasets[0], id: "other" } as Dataset;
    const dataset = useDatasetStore();
    dataset.setMetadata(other);
    const otherArea = { type: "Point", coordinates: [1, 2] };
    dataset.setGeoJson(otherArea);
    dataset.setTemporalRange([1700, 1800]);
    reply(
      new Response(
        JSON.stringify({
          ...metadataFixture,
          datasets: [...metadataFixture.datasets, other],
        }),
      ),
    );
    await rejected;
    expect(dataset.metadata?.id).toBe("other");
    expect(dataset.geoJson).toEqual(otherArea);
    expect(dataset.temporalRange).toEqual([1700, 1800]);
    expect(useAnalysisStore().requestData).toEqual({});
  });
  it.each([
    [
      "malformed geometry",
      {
        ...request,
        selected_area: { type: "Point", coordinates: ["bad", 37] },
      },
    ],
    [
      "reversed range",
      { ...request, time_range: { gte: "1600", lte: "1500" } },
    ],
    ["unavailable dataset", { ...request, dataset_id: "missing" }],
    ["unavailable variable", { ...request, variable_id: "missing" }],
    [
      "out-of-coverage range",
      { ...request, time_range: { gte: "0001", lte: "1500" } },
    ],
  ])("keeps all active state unchanged for %s", async (_description, input) => {
    const dataset = useDatasetStore();
    dataset.setMetadata(metadataFixture.datasets[0] as Dataset);
    dataset.setGeoJson({ type: "Point", coordinates: [1, 2] });
    dataset.setTemporalRange([1700, 1800]);
    const analysis = useAnalysisStore();
    analysis.setRequestData({ zonal_statistic: "median" });
    const catalog = useMetadataStore();
    catalog.setAllDatasetMetadata(metadataFixture.datasets as Dataset[]);
    const snapshot = () =>
      JSON.stringify([dataset.$state, analysis.$state, catalog.$state]);
    const previous = snapshot();
    await expect(useSavedAnalysis().restore(input)).rejects.toThrow();
    expect(snapshot()).toBe(previous);
    if (
      _description === "malformed geometry" ||
      _description === "reversed range"
    )
      expect(fetch).not.toHaveBeenCalled();
  });
});
