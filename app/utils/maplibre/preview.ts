import * as maplibregl from "maplibre-gl";
import type { Dataset } from "@/types/metadata";
import { getInitialMapViewport } from "@/composables/useMapInitialViewport";
import {
  getBasemaps,
  DEFAULT_BASEMAP_ID,
  createBasemapStyle,
} from "./basemaps";
import { mapExtentPolygon } from "./geometry";
import { MAP_COLORS } from "@/utils/colors";

type PreviewMetadata = Pick<Dataset, "bbox" | "map_view">;

/** Lightweight discovery preview, independent of drawing and analysis stores. */
export function createMapPreview(metadata: () => PreviewMetadata) {
  let map: maplibregl.Map | null = null;
  let loaded = false;
  let resizeObserver: ResizeObserver | null = null;
  let loadHandler: (() => void) | null = null;

  function update() {
    if (!map || !loaded) return;
    const data = mapExtentPolygon(metadata().bbox);
    const source = map.getSource("preview-region") as
      maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(data);
    else {
      map.addSource("preview-region", { type: "geojson", data });
      map.addLayer({
        id: "preview-region-fill",
        type: "fill",
        source: "preview-region",
        paint: { "fill-color": MAP_COLORS.datasetExtent, "fill-opacity": 0.12 },
      });
      map.addLayer({
        id: "preview-region-outline",
        type: "line",
        source: "preview-region",
        paint: { "line-color": MAP_COLORS.datasetExtent, "line-width": 2 },
      });
    }
    const viewport = getInitialMapViewport(metadata());
    if ("bbox" in viewport)
      map.fitBounds(viewport.bbox, { padding: 20, duration: 0 });
    else
      map.jumpTo({
        center: [viewport.center.lon, viewport.center.lat],
        zoom: viewport.zoom,
      });
  }

  function mount(container: HTMLElement) {
    if (map) return;
    const viewport = getInitialMapViewport(metadata());
    const basemap = getBasemaps().filter(
      (layer) => layer.id === DEFAULT_BASEMAP_ID,
    );
    const target = new maplibregl.Map({
      container,
      style: createBasemapStyle(basemap, DEFAULT_BASEMAP_ID),
      interactive: false,
      minZoom: 2,
      attributionControl: { compact: true },
      ...("bbox" in viewport
        ? { bounds: viewport.bbox, fitBoundsOptions: { padding: 20 } }
        : {
            center: [viewport.center.lon, viewport.center.lat],
            zoom: viewport.zoom,
          }),
    });
    map = target;
    map.addControl(new maplibregl.ScaleControl(), "bottom-left");
    loadHandler = () => {
      if (map !== target) return;
      loaded = true;
      update();
    };
    map.on("load", loadHandler);
    resizeObserver = new ResizeObserver(() => map?.resize());
    resizeObserver.observe(container);
  }

  function dispose() {
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (map && loadHandler) map.off("load", loadHandler);
    map?.remove();
    map = null;
    loadHandler = null;
    loaded = false;
  }
  return { mount, update, dispose };
}
