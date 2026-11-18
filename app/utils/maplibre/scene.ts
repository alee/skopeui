import * as maplibregl from "maplibre-gl";
import type { Dataset } from "@/types/metadata";
import { getInitialMapViewport } from "@/composables/useMapInitialViewport";
import { FILL_LAYER_ID } from "./config";
import {
  createBasemapStyle,
  basemapLayerId,
  type BasemapLayer,
} from "./basemaps";
import { mapExtentPolygon } from "./geometry";
import { MAP_COLORS } from "@/utils/colors";

interface SceneOptions {
  baseLayers: readonly BasemapLayer[];
  metadata: () => Dataset | null;
  selectedBaseLayerId: () => string;
  onBasemapControl: (element: HTMLElement | null) => void;
  onLoad: (map: maplibregl.Map) => Promise<void>;
  beforeRemove: () => void;
}

export function createMapScene(options: SceneOptions) {
  let map: maplibregl.Map | null = null;
  let isMapLoaded = false;
  let basemapControl: HTMLElement | null = null;
  function applyBaseLayerSelection(baseLayerIdValue: string) {
    if (!map || !isMapLoaded) return;
    for (const provider of options.baseLayers) {
      const rasterLayerId = basemapLayerId(provider.id);
      if (!map.getLayer(rasterLayerId)) continue;
      map.setLayoutProperty(
        rasterLayerId,
        "visibility",
        provider.id === baseLayerIdValue ? "visible" : "none",
      );
    }
  }

  function addMetadataExtentLayer() {
    const bounds = options.metadata()?.bbox;
    if (!map || !isMapLoaded || !bounds) return;

    const sourceId = "dataset-region";
    const lineLayerId = "dataset-region-outline";

    if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
    if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    map.addSource(sourceId, {
      type: "geojson",
      data: mapExtentPolygon(bounds),
    });

    map.addLayer({
      id: FILL_LAYER_ID,
      type: "fill",
      source: sourceId,
      paint: { "fill-color": MAP_COLORS.datasetExtent, "fill-opacity": 0.05 },
    });

    map.addLayer({
      id: lineLayerId,
      type: "line",
      source: sourceId,
      paint: { "line-color": MAP_COLORS.datasetExtent, "line-width": 2 },
    });
  }

  async function handleLoad() {
    if (!map) return;
    isMapLoaded = true;
    addMetadataExtentLayer();
    await options.onLoad(map);
  }

  function mount(container: HTMLElement) {
    const viewport = getInitialMapViewport(options.metadata());
    map = new maplibregl.Map({
      container,
      style: createBasemapStyle(
        options.baseLayers,
        options.selectedBaseLayerId(),
      ),
      minZoom: 2,
      ...("bbox" in viewport
        ? { bounds: viewport.bbox, fitBoundsOptions: { padding: 20 } }
        : {
            center: [viewport.center.lon, viewport.center.lat],
            zoom: viewport.zoom,
          }),
    });
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    map.addControl(
      {
        onAdd: () => {
          basemapControl = document.createElement("div");
          basemapControl.className = "maplibregl-ctrl maplibregl-ctrl-group";
          options.onBasemapControl(basemapControl);
          return basemapControl;
        },
        onRemove: () => {
          basemapControl?.remove();
          basemapControl = null;
          options.onBasemapControl(null);
        },
      },
      "top-right",
    );
    map.addControl(new maplibregl.ScaleControl(), "bottom-right");
    map.on("load", handleLoad);
  }

  function dispose() {
    options.beforeRemove();
    isMapLoaded = false;
    map?.off("load", handleLoad);
    map?.remove();
    map = null;
    basemapControl?.remove();
    basemapControl = null;
    options.onBasemapControl(null);
  }

  return {
    mount,
    dispose,
    isReady: () => isMapLoaded && map != null,
    updateExtent: addMetadataExtentLayer,
    selectBaseLayer: applyBaseLayerSelection,
  };
}
