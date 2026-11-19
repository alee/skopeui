import { describe, expect, it } from "vitest";
import {
  getBasemaps,
  createBasemapStyle,
  DEFAULT_BASEMAP_ID,
} from "@/utils/maplibre/basemaps";

describe("basemaps", () => {
  it("keeps the existing Esri maps available without credentials", () => {
    const layers = getBasemaps();
    expect(layers.map((layer) => layer.name)).toEqual([
      "Esri.WorldTopoMap",
      "Esri.WorldGrayCanvas",
      "Esri.WorldTerrain",
    ]);
    expect(
      layers.find((layer) => layer.id === DEFAULT_BASEMAP_ID),
    ).toBeDefined();
    expect(
      layers.find((layer) => layer.name === "Esri.WorldTerrain")?.maxzoom,
    ).toBe(13);
  });
  it("includes Positron only with a configured key and encodes it safely", () => {
    expect(
      getBasemaps({ cartoApiKey: " " }).some(
        (layer) => layer.name === "CartoDB.Positron",
      ),
    ).toBe(false);
    const layer = getBasemaps({ cartoApiKey: " key&value? " }).find(
      (entry) => entry.name === "CartoDB.Positron",
    )!;
    expect(layer.tiles).toEqual([
      "https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=key%26value%3F",
    ]);
    expect(layer.attribution).toContain("OpenStreetMap");
    expect(layer.attribution).toContain("CARTO");
  });
  it("supports Toner Lite using either explicit domain authentication or an API key", () => {
    const domain = getBasemaps({ stadiaDomainAuth: "true" }).find(
      (layer) => layer.name === "Stamen.TonerLite",
    )!;
    expect(domain.tiles).toEqual([
      "https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}.png",
    ]);
    expect(domain.attribution).toContain("Stadia Maps");
    expect(domain.attribution).toContain("Stamen Design");
    const keyed = getBasemaps({ stadiaApiKey: "a&b" }).find(
      (layer) => layer.id === domain.id,
    )!;
    expect(keyed.tiles[0]!.endsWith("?api_key=a%26b")).toBe(true);
    expect(
      getBasemaps({ stadiaDomainAuth: "false" }).some(
        (layer) => layer.id === domain.id,
      ),
    ).toBe(false);
  });
  it("sets provider zoom bounds and selects only the requested base layer", () => {
    const layers = getBasemaps({ cartoApiKey: "test" });
    const style = createBasemapStyle(layers, "esri-worldterrain");
    expect(style.sources["basemap-source-esri-worldterrain"]).toMatchObject({
      maxzoom: 13,
      tileSize: 256,
    });
    expect(
      style.layers
        .filter((layer) => layer.layout?.visibility === "visible")
        .map((layer) => layer.id),
    ).toEqual(["basemap-layer-esri-worldterrain"]);
    expect(style.layers[0]!.layout?.visibility).toBe("none");
  });
});
