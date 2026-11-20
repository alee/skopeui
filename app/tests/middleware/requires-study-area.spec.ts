import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import { useDatasetStore } from "@/stores/dataset";
import metadataFixture from "@/tests/fixtures/metadata-1.0.0.json";
import { useMessagesStore } from "@/stores/messages";

const navigateTo = vi.fn((location: unknown) => location);
vi.stubGlobal("defineNuxtRouteMiddleware", (middleware: unknown) => middleware);
vi.stubGlobal("navigateTo", navigateTo);

const { default: requiresStudyArea } =
  await import("@/middleware/requires-study-area");

const visualize = {
  name: "dataset-id-visualize-variable",
  params: { id: "paleocar_v3", variable: "ppt_annual" },
};
const area = {
  type: "Feature",
  properties: {},
  geometry: { type: "Point", coordinates: [-108.5, 37] },
};

describe("requires-study-area middleware", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  afterEach(() => {
    navigateTo.mockClear();
  });

  it("sends the user to select an area when there is none", () => {
    const result = (requiresStudyArea as any)(visualize);

    expect(result).toEqual({
      name: "dataset-id",
      params: { id: "paleocar_v3" },
    });
    const message = useMessagesStore().messages[0]!;
    expect(message.message).toMatch(/Select a study area first/);
  });

  it.each([
    {},
    { type: "FeatureCollection", features: [] },
    { type: "Feature", geometry: null },
  ])("does not admit an empty persisted selection: %j", (invalid) => {
    localStorage.setItem("geojson:paleocar_v3", JSON.stringify(invalid));
    expect((requiresStudyArea as any)(visualize)).toBeDefined();
  });

  it("lets the page open with an area saved in the browser", () => {
    localStorage.setItem("geojson:paleocar_v3", JSON.stringify(area));

    expect((requiresStudyArea as any)(visualize)).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it("doesn't count another dataset's saved area", () => {
    localStorage.setItem("geojson:lbda_v2", JSON.stringify(area));

    expect((requiresStudyArea as any)(visualize)).toBeDefined();
  });

  it("lets the page open with an area already in the store", () => {
    const store = useDatasetStore();
    store.setMetadata(metadataFixture.datasets[0] as any);
    store.setGeoJson(area);

    expect((requiresStudyArea as any)(visualize)).toBeUndefined();
  });
});
