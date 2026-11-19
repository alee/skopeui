import { describe, expect, it } from "vitest";

import { getInitialMapViewport } from "@/composables/useMapInitialViewport";

const bbox: [number, number, number, number] = [-115, 31, -102, 43];

describe("getInitialMapViewport", () => {
  it("uses the dataset's map_view when it has one", () => {
    const viewport = getInitialMapViewport({
      bbox,
      map_view: { center: { lon: -108.5, lat: 37 }, zoom: 4 },
    });

    expect(viewport).toEqual({ center: { lon: -108.5, lat: 37 }, zoom: 4 });
  });

  it("fits the bbox when there is no map_view", () => {
    expect(getInitialMapViewport({ bbox, map_view: null })).toEqual({ bbox });
  });

  it("falls back to the whole world without a dataset", () => {
    expect(getInitialMapViewport(null)).toEqual({
      center: { lon: 0, lat: 0 },
      zoom: 2,
    });
  });
});
