import type { Map, GeoJSONSource } from "maplibre-gl";
import type { Geoman } from "@geoman-io/maplibre-geoman-free";
import { createGeomanInstance } from "@geoman-io/maplibre-geoman-free";
import { bbox as turfBbox } from "@turf/turf";
import { MAP_COLORS, MAP_OPACITIES } from "@/utils/colors";
import { emptyFeatureCollection, normalizeGeoJson } from "./geometry";
import {
  createGeomanOptions,
  MAX_FIT_ZOOM,
  STUDY_AREA_SOURCE_ID,
  STUDY_AREA_FILL_LAYER_ID,
  STUDY_AREA_HALO_LAYER_ID,
  STUDY_AREA_LINE_LAYER_ID,
  STUDY_AREA_POINT_LAYER_ID,
} from "./config";

interface StudyAreaOptions {
  editable: () => boolean;
  geometry: () => unknown;
  save: (geometry: unknown) => void;
  clear: () => void;
  onTool: (tool: string | null) => void;
  onPointer: (point: { x: number; y: number } | null) => void;
}

export function createStudyAreaController(options: StudyAreaOptions) {
  let map: Map | null = null;
  let activeTool: string | null = null;
  let gm: Geoman | null = null;
  let ignoreStoreWatch = false;
  let syncDrawQueue: Promise<void> = Promise.resolve();
  let isMapLoaded = false;
  let disposed = false;
  let zoomTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners: Array<[string, (event: any) => void]> = [];
  let pendingStudyAreaGeoJson: any = null;

  function fitToGeoJson(geoJson: any) {
    if (!map || !geoJson) return;
    try {
      const [minX, minY, maxX, maxY] = turfBbox(geoJson as any);
      map.fitBounds(
        [
          [minX, minY],
          [maxX, maxY],
        ],
        { padding: 30, duration: 0, maxZoom: MAX_FIT_ZOOM },
      );
    } catch {
      // Ignore invalid geometries during exploratory migration.
    }
  }

  function ensureStudyAreaDisplayLayer() {
    if (!map) return;

    if (!map.getSource(STUDY_AREA_SOURCE_ID)) {
      map.addSource(STUDY_AREA_SOURCE_ID, {
        type: "geojson",
        data: emptyFeatureCollection() as any,
      });
    }

    if (!map.getLayer(STUDY_AREA_FILL_LAYER_ID)) {
      map.addLayer({
        id: STUDY_AREA_FILL_LAYER_ID,
        type: "fill",
        source: STUDY_AREA_SOURCE_ID,
        paint: {
          "fill-color": MAP_COLORS.studyArea,
          "fill-opacity": MAP_OPACITIES.studyAreaOverData,
        },
      });
    }

    // A wider white line under the outline, so it shows over any data layer.
    if (!map.getLayer(STUDY_AREA_HALO_LAYER_ID)) {
      map.addLayer({
        id: STUDY_AREA_HALO_LAYER_ID,
        type: "line",
        source: STUDY_AREA_SOURCE_ID,
        paint: {
          "line-color": MAP_COLORS.studyAreaHalo,
          "line-width": 5,
        },
      });
    }

    if (!map.getLayer(STUDY_AREA_LINE_LAYER_ID)) {
      map.addLayer({
        id: STUDY_AREA_LINE_LAYER_ID,
        type: "line",
        source: STUDY_AREA_SOURCE_ID,
        paint: {
          "line-color": MAP_COLORS.studyArea,
          "line-width": 2.5,
        },
      });
    }

    // Fill and line layers draw nothing for a point, so it needs its own.
    if (!map.getLayer(STUDY_AREA_POINT_LAYER_ID)) {
      map.addLayer({
        id: STUDY_AREA_POINT_LAYER_ID,
        type: "circle",
        source: STUDY_AREA_SOURCE_ID,
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 6,
          "circle-color": MAP_COLORS.studyArea,
          "circle-stroke-color": MAP_COLORS.studyAreaHalo,
          "circle-stroke-width": 2,
        },
      });
    }
  }

  function bringStudyAreaDisplayToFront() {
    if (!map || typeof (map as any).moveLayer !== "function") {
      return;
    }

    if (
      !map.getLayer(STUDY_AREA_LINE_LAYER_ID) ||
      !map.getLayer(STUDY_AREA_FILL_LAYER_ID)
    ) {
      return;
    }

    map.moveLayer(STUDY_AREA_FILL_LAYER_ID);
    if (map.getLayer(STUDY_AREA_HALO_LAYER_ID)) {
      map.moveLayer(STUDY_AREA_HALO_LAYER_ID);
    }
    map.moveLayer(STUDY_AREA_LINE_LAYER_ID);
    if (map.getLayer(STUDY_AREA_POINT_LAYER_ID)) {
      map.moveLayer(STUDY_AREA_POINT_LAYER_ID);
    }
  }

  function updateStudyAreaDisplay(geoJson: any) {
    if (!map || !isMapLoaded) {
      pendingStudyAreaGeoJson = geoJson;
      return;
    }

    ensureStudyAreaDisplayLayer();
    const source = map.getSource(STUDY_AREA_SOURCE_ID) as
      GeoJSONSource | undefined;
    if (!source) return;

    const featureCollection =
      normalizeGeoJson(geoJson) || emptyFeatureCollection();
    source.setData(featureCollection as any);
    bringStudyAreaDisplayToFront();

    if (featureCollection.features.length > 0) {
      fitToGeoJson(featureCollection);
    }
  }

  function syncDrawFromStore(geoJson: any) {
    if (!gm) return Promise.resolve();

    // Geoman may annotate imported features. Keep those mutations outside
    // reactive store data so they cannot enqueue their own synchronization.
    const geoJsonToSync =
      geoJson == null ? null : JSON.parse(JSON.stringify(geoJson));
    syncDrawQueue = syncDrawQueue
      .catch(() => undefined)
      .then(async () => {
        const geoman = gm;
        if (!geoman) return;

        ignoreStoreWatch = true;
        try {
          await geoman.features.deleteAll();
          if (gm !== geoman) return;

          const featureCollection = normalizeGeoJson(geoJsonToSync);
          if (featureCollection && featureCollection.features.length > 0) {
            await geoman.features.importGeoJson(featureCollection);
            fitToGeoJson(featureCollection);
          }
        } finally {
          ignoreStoreWatch = false;
        }
      });

    return syncDrawQueue;
  }

  const EDIT_EVENT_MODES: Record<string, string> = {
    drag: "drag",
    change: "edit",
    rotate: "rotate",
    delete: "delete",
  };

  // Switching tools can report the new one before the old one ends, so only the
  // active tool's end clears it.
  function setActiveTool(tool: string, enabled: boolean) {
    if (enabled) {
      activeTool = tool;
      options.onTool(tool);
    } else if (activeTool === tool) {
      activeTool = null;
      options.onTool(null);
    }
  }

  // geoman emits every shape as standard GeoJSON; a circle arrives as a Polygon.
  function handleGmCreate(event: any) {
    if (disposed || ignoreStoreWatch) return;

    const geoJson = event.feature?.getGeoJson?.();
    if (!geoJson) return;

    options.save(geoJson);
    fitToGeoJson(geoJson);
  }

  function handleGmEditEnd(event: any) {
    if (disposed || ignoreStoreWatch) return;

    const geoJson = event.feature?.getGeoJson?.();
    if (!geoJson) return;

    options.save(geoJson);
  }

  function handleGmRemove() {
    if (disposed || ignoreStoreWatch) return;
    options.clear();
  }

  function listen(event: string, handler: (event: any) => void) {
    (map as any).on(event, handler);
    listeners.push([event, handler]);
  }

  async function initialize(target: Map) {
    map = target;
    isMapLoaded = true;
    if (options.editable()) {
      const geoman = await createGeomanInstance(
        target as any,
        createGeomanOptions(),
      );
      if (disposed || map !== target) {
        geoman.destroy();
        return false;
      }
      gm = geoman;
      await syncDrawFromStore(options.geometry());
      if (disposed || map !== target) return false;
      listen("gm:create", handleGmCreate);
      listen("gm:editend", handleGmEditEnd);
      listen("gm:remove", handleGmRemove);
      // Geoman starts an uncapped fit; replace it on the following task.
      listen("gm:globalzoom_to_featuresmodetoggled", (event) => {
        if (event.enabled) {
          clearTimeout(zoomTimer);
          zoomTimer = setTimeout(() => fitToGeoJson(options.geometry()));
        }
      });
      listen("gm:globaldrawmodetoggled", (event) =>
        setActiveTool(event.shape, event.enabled),
      );
      for (const [tool, eventMode] of Object.entries(EDIT_EVENT_MODES)) {
        listen(`gm:global${eventMode}modetoggled`, (event) =>
          setActiveTool(tool, event.enabled),
        );
      }
      listen("mousemove", (event) =>
        options.onPointer({ x: event.point.x, y: event.point.y }),
      );
      listen("mouseout", () => options.onPointer(null));
    } else {
      updateStudyAreaDisplay(pendingStudyAreaGeoJson ?? options.geometry());
      pendingStudyAreaGeoJson = null;
    }
    return true;
  }

  function updateGeometry(geometry: unknown) {
    if (disposed) return;
    // Programmatic Geoman events are suppressed in the handlers, but a newer
    // store selection must still queue while an earlier import is in flight.
    if (options.editable()) {
      void syncDrawFromStore(geometry);
      return;
    }
    updateStudyAreaDisplay(geometry);
  }

  function dispose() {
    disposed = true;
    isMapLoaded = false;
    pendingStudyAreaGeoJson = null;
    clearTimeout(zoomTimer);
    for (const [event, handler] of listeners) (map as any)?.off(event, handler);
    listeners.length = 0;
    const geoman = gm;
    gm = null;
    geoman?.destroy();
    map = null;
  }

  return { initialize, updateGeometry, dispose };
}
