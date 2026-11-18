import type { StyleSpecification, SourceSpecification } from "maplibre-gl";

export interface BasemapLayer {
  id: string;
  name: string;
  tiles: string[];
  attribution: string;
  maxzoom: number;
}

export interface BasemapConfig {
  cartoApiKey?: string;
  stadiaApiKey?: string;
  stadiaDomainAuth?: boolean | string;
}

export const DEFAULT_BASEMAP_ID = "esri-worldtopomap";

/** Fresh, library-neutral definitions; authenticated providers require configuration. */
export function getBasemaps(config: BasemapConfig = {}): BasemapLayer[] {
  const layers: BasemapLayer[] = [
    {
      id: DEFAULT_BASEMAP_ID,
      name: "Esri.WorldTopoMap",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      ],
      attribution:
        "Sources: Esri, HERE, Garmin, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), &copy; OpenStreetMap contributors, and the GIS User Community",
      maxzoom: 23,
    },
    {
      id: "esri-worldgraycanvas",
      name: "Esri.WorldGrayCanvas",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      ],
      attribution:
        "Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community",
      maxzoom: 23,
    },
    {
      id: "esri-worldterrain",
      name: "Esri.WorldTerrain",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}",
      ],
      attribution: "Sources: Esri, USGS, NOAA",
      maxzoom: 13,
    },
  ];
  const stadiaKey = config.stadiaApiKey?.trim();
  if (
    stadiaKey ||
    config.stadiaDomainAuth === true ||
    config.stadiaDomainAuth === "true"
  ) {
    layers.push({
      id: "stamen-tonerlite",
      name: "Stamen.TonerLite",
      tiles: [
        `https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}.png${stadiaKey ? `?api_key=${encodeURIComponent(stadiaKey)}` : ""}`,
      ],
      attribution:
        '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com/">Stamen Design</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxzoom: 20,
    });
  }
  const cartoKey = config.cartoApiKey?.trim();
  if (cartoKey) {
    layers.push({
      id: "cartodb-positron",
      name: "CartoDB.Positron",
      tiles: [
        `https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=${encodeURIComponent(cartoKey)}`,
      ],
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attribution/">CARTO</a>',
      maxzoom: 20,
    });
  }
  return layers;
}

export const basemapSourceId = (id: string) => `basemap-source-${id}`;
export const basemapLayerId = (id: string) => `basemap-layer-${id}`;

export function createBasemapStyle(
  layers: readonly BasemapLayer[],
  selectedId: string,
): StyleSpecification {
  const sources: Record<string, SourceSpecification> = {};
  for (const layer of layers) {
    sources[basemapSourceId(layer.id)] = {
      type: "raster",
      tiles: [...layer.tiles],
      tileSize: 256,
      maxzoom: layer.maxzoom,
      attribution: layer.attribution,
    };
  }
  return {
    version: 8,
    sources,
    layers: layers.map((layer) => ({
      id: basemapLayerId(layer.id),
      type: "raster",
      source: basemapSourceId(layer.id),
      layout: { visibility: layer.id === selectedId ? "visible" : "none" },
    })),
  };
}
