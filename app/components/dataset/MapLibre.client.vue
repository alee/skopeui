<template>
  <v-card
    class="map-card"
    height="100%"
    width="100%"
    elevation="1"
    variant="outlined"
  >
    <PanelHeader>
      <!-- No readout while selecting: the API measures the area on extraction. -->
      <AreaReadout v-if="!isSelectArea" />
      <!-- What to do next. Stays put while a tool is active; that tool's own
           instruction follows the pointer. -->
      <div v-if="isSelectArea" class="draw-callout" data-test="draw-callout">
        {{ datasetStore.geoJson ? EDIT_CALLOUT : DRAW_CALLOUT }}
      </div>
      <!-- Keep both actions reachable when the header is narrow. -->
      <div v-if="isSelectArea" class="geojson-actions">
        <input
          id="loadGeoJsonFile"
          type="file"
          accept=".geojson"
          style="display: none"
          @change="loadGeoJson"
        >
        <v-btn
          size="small"
          color="secondary"
          variant="outlined"
          prepend-icon="mdi-upload"
          @click="selectGeoJsonFile"
        >
          Upload GeoJSON
        </v-btn>
        <v-btn
          size="small"
          color="secondary"
          variant="flat"
          :disabled="!datasetStore.geoJson"
          prepend-icon="mdi-download"
          @click="exportSelectedGeometry"
        >
          <a id="exportSelectedGeometry">Download GeoJSON</a>
        </v-btn>
      </div>
    </PanelHeader>
    <v-card-text class="map">
      <div class="map-frame">
        <div ref="mapContainer" class="maplibre-map" />
        <div
          v-if="cursorHint && drawPointer"
          class="draw-cursor-hint"
          :style="{ left: `${drawPointer.x}px`, top: `${drawPointer.y}px` }"
          data-test="draw-cursor-hint"
        >
          {{ cursorHint }}
        </div>
      </div>
      <!-- Sits in MapLibre's top-right control stack, under the zoom buttons. -->
      <Teleport v-if="basemapControlEl" :to="basemapControlEl">
        <v-menu location="start top">
          <template #activator="{ props: menuProps }">
            <button
              v-bind="menuProps"
              type="button"
              title="Base map"
              aria-label="Base map"
              data-test="basemap-button"
            >
              <v-icon size="18">
                mdi-layers-outline
              </v-icon>
            </button>
          </template>
          <v-list density="compact">
            <v-list-subheader>Base map</v-list-subheader>
            <v-list-item
              v-for="option in baseLayerOptions"
              :key="option.value"
              :title="option.title"
              :active="option.value === selectedBaseLayerId"
              color="primary"
              data-test="basemap-option"
              @click="selectedBaseLayerId = option.value"
            />
          </v-list>
        </v-menu>
      </Teleport>
      <div v-if="isStepLoading" class="map-step-loading">
        <v-progress-circular
          indeterminate
          color="primary"
          size="48"
          width="4"
        />
      </div>
    </v-card-text>
    <slot name="footer" />
  </v-card>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import * as maplibregl from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import AreaReadout from "@/components/dataset/AreaReadout.vue";
import PanelHeader from "@/components/dataset/PanelHeader.vue";
import { SkopeColorbar, type ColorbarOptions } from "@/utils/SkopeColorbar";
import { MAP_COLORS, MAP_OPACITIES } from "@/utils/colors";
import { timestepKey } from "@/utils/timeAxis";
import type { Geoman } from "@geoman-io/maplibre-geoman-free";
import { createGeomanInstance } from "@geoman-io/maplibre-geoman-free";
import { bbox as turfBbox } from "@turf/turf";
import "maplibre-gl/dist/maplibre-gl.css";
import "@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css";
import {
  DEFAULT_BASEMAP,
  LEAFLET_PROVIDERS,
  TILES_ENDPOINT,
} from "@/store/modules/constants";
import { useStudyArea } from "@/composables/useStudyArea";
import {
  getInitialMapViewport,
  type Bbox,
} from "@/composables/useMapInitialViewport";
import { useAppStore } from "@/stores/app";
import { useDatasetStore } from "@/stores/dataset";
import { useMessagesStore } from "@/stores/messages";

let colorbar: SkopeColorbar | null = null;

const props = defineProps({
  step: { type: Number, default: 2000 },
  displayRaster: { type: Boolean, default: true },
});
const emit = defineEmits(["mapReady", "stepReady", "stepError"]);

const route = useRoute();
const appStore = useAppStore();
const datasetStore = useDatasetStore();
const messageStore = useMessagesStore();
const studyArea = useStudyArea();

const mapContainer = ref<HTMLElement | null>(null);
const isStepLoading = ref(false);

const stepNames = computed(() => appStore.stepNames);
const metadata = computed(() => datasetStore.metadata);
const currentStep = computed(() =>
  stepNames.value.findIndex((x: unknown) => x === route.name),
);
const isSelectArea = computed(() => currentStep.value === 1);
const activeTool = ref<string | null>(null);
// The active tool's instruction follows the pointer, where the user is looking
// while drawing or editing.
const cursorHint = computed(
  () => activeTool.value && TOOL_INSTRUCTIONS[activeTool.value],
);
const drawPointer = ref<{ x: number; y: number } | null>(null);

const cogBaseUrl = computed(getCogBaseUrl);
const legendVisible = computed(() => props.displayRaster && !!cogBaseUrl.value);
// The legend draws the variable's display entry as served, so it shows the
// same range and palette the API used for the tiles (DISP-004).
const legendOptions = computed((): ColorbarOptions | null => {
  const variable = datasetStore.variable;
  const display = variable?.display;
  if (!display?.range || display.colors.length < 2) return null;
  return {
    colors: display.colors,
    range: display.range,
    ticks: display.ticks,
    units: variable.unit,
  };
});
type MapLibreBaseLayer = {
  id: string;
  name: string;
  tiles: string[];
  attribution: string;
};

function providerNameToId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function resolveSubdomains(provider: any): string[] {
  if (Array.isArray(provider?.subdomains) && provider.subdomains.length > 0) {
    return provider.subdomains;
  }
  if (
    typeof provider?.subdomains === "string" &&
    provider.subdomains.length > 0
  ) {
    return provider.subdomains.split("");
  }
  return ["a", "b", "c", "d"];
}

function providerToMapLibreTiles(provider: any): string[] {
  const urlTemplate = String(provider?.url || "").replace(/\{r\}/g, "");
  if (!urlTemplate) return [];

  if (!urlTemplate.includes("{s}")) {
    return [urlTemplate];
  }

  return resolveSubdomains(provider).map((subdomain) =>
    urlTemplate.replace(/\{s\}/g, subdomain),
  );
}

const mapBaseLayers: MapLibreBaseLayer[] = LEAFLET_PROVIDERS.map(
  (provider: any) => ({
    id: providerNameToId(provider.name),
    name: provider.name,
    tiles: providerToMapLibreTiles(provider),
    attribution: provider.attribution,
  }),
).filter((provider: MapLibreBaseLayer) => provider.tiles.length > 0);

const defaultBaseLayer =
  mapBaseLayers.find((provider) => provider.name === DEFAULT_BASEMAP) ??
  mapBaseLayers[0];
const selectedBaseLayerId = ref(defaultBaseLayer?.id ?? "");
const basemapControlEl = ref<HTMLElement | null>(null);
const baseLayerOptions = computed(() =>
  mapBaseLayers.map((provider) => ({
    title: provider.name,
    value: provider.id,
  })),
);

// What to do with each tool, keyed by geoman's mode name. Every drawing tool
// works by clicking, not by dragging. Shown on the tool's tooltip and next to
// the pointer while the tool is active.
const DRAW_INSTRUCTIONS: Record<string, string> = {
  marker: "Click the map to place the point.",
  circle: "Click the center, then click again to set the radius.",
  rectangle: "Click one corner, then click the opposite corner.",
  polygon: "Click each corner, then click the first one again to finish.",
};
const EDIT_INSTRUCTIONS: Record<string, string> = {
  drag: "Drag the shape to move it.",
  change: "Drag a corner to change the shape.",
  rotate: "Drag a corner to rotate the shape.",
  delete: "Click the shape to remove it.",
};
const TOOL_INSTRUCTIONS = { ...DRAW_INSTRUCTIONS, ...EDIT_INSTRUCTIONS };
// Shown in the map's header on select area.
const DRAW_CALLOUT =
  "Choose a shape to draw your study area, or upload a GeoJSON file.";
const EDIT_CALLOUT =
  "Draw a new shape to replace this one, or use the tools below to drag, change, rotate or delete it.";

// A study area is a polygon, rectangle, circle or point; hide geoman's other
// drawing tools. Cutting a hole in the one shape isn't useful. Snapping stays
// on without its button: it lets a polygon close on a click near its first
// corner.
const GEOMAN_OPTIONS = {
  controls: {
    draw: {
      marker: { title: `Point: ${DRAW_INSTRUCTIONS.marker}` },
      circle: { title: `Circle: ${DRAW_INSTRUCTIONS.circle}` },
      rectangle: { title: `Rectangle: ${DRAW_INSTRUCTIONS.rectangle}` },
      polygon: { title: `Polygon: ${DRAW_INSTRUCTIONS.polygon}` },
      circle_marker: { uiEnabled: false },
      text_marker: { uiEnabled: false },
      ellipse: { uiEnabled: false },
      line: { uiEnabled: false },
    },
    edit: {
      drag: { title: `Drag: ${EDIT_INSTRUCTIONS.drag}` },
      change: { title: `Change: ${EDIT_INSTRUCTIONS.change}` },
      rotate: { title: `Rotate: ${EDIT_INSTRUCTIONS.rotate}` },
      delete: { title: `Delete: ${EDIT_INSTRUCTIONS.delete}` },
      cut: { uiEnabled: false },
    },
    helper: {
      snapping: { uiEnabled: false, active: true },
      zoom_to_features: { title: "Zoom to shape" },
    },
  },
  layerStyles: geomanStudyAreaStyles(),
};

// geoman draws the shape being drawn or edited itself, in its own blue and
// orange; give it the study area's colors, with the outline of a shape still
// being drawn in its own. Each entry replaces those values of geoman's layer
// of that type and keeps the rest.
function geomanStudyAreaStyles() {
  const shape = (outline: string) => [
    {
      type: "fill",
      paint: {
        "fill-color": MAP_COLORS.studyArea,
        "fill-opacity": MAP_OPACITIES.studyAreaDrawing,
      },
    },
    { type: "line", paint: { "line-color": outline } },
  ];
  return Object.fromEntries(
    ["polygon", "rectangle", "circle"].map((name) => [
      name,
      {
        gm_main: shape(MAP_COLORS.studyArea),
        gm_temporary: shape(MAP_COLORS.drawing),
      },
    ]),
  );
}

let map: maplibregl.Map | null = null;
let gm: Geoman | null = null;
let ignoreStoreWatch = false;
let syncDrawQueue: Promise<void> = Promise.resolve();
let isMapLoaded = false;
let pendingStudyAreaGeoJson: any = null;

const COG_A = { sourceId: "cog-source-a", layerId: "cog-layer-a" };
const COG_B = { sourceId: "cog-source-b", layerId: "cog-layer-b" };
let cogFront = COG_A; // currently visible slot
let cogBack = COG_B; // currently loading / empty slot
let pendingFrameCheck: (() => void) | null = null;
let pendingFrameSource: string | null = null;
let pendingFrameStep: number | null = null;
const FILL_LAYER_ID = "dataset-region-fill";
const STUDY_AREA_SOURCE_ID = "study-area-display";
const STUDY_AREA_FILL_LAYER_ID = "study-area-display-fill";
const STUDY_AREA_HALO_LAYER_ID = "study-area-display-halo";
const STUDY_AREA_LINE_LAYER_ID = "study-area-display-outline";
const STUDY_AREA_POINT_LAYER_ID = "study-area-display-point";
// Fitting a point's zero-size bbox would zoom all the way in; at zoom 10 one of
// paleocar_v3's 30" cells is a few pixels across.
const MAX_FIT_ZOOM = 10;

function emptyFeatureCollection() {
  return { type: "FeatureCollection", features: [] as any[] };
}

function baseSourceId(baseLayerId: string) {
  return `basemap-source-${baseLayerId}`;
}

function baseLayerId(baseLayerId: string) {
  return `basemap-layer-${baseLayerId}`;
}

function applyBaseLayerSelection(baseLayerIdValue: string) {
  if (!map || !isMapLoaded) return;
  for (const provider of mapBaseLayers) {
    const rasterLayerId = baseLayerId(provider.id);
    if (!map.getLayer(rasterLayerId)) continue;
    map.setLayoutProperty(
      rasterLayerId,
      "visibility",
      provider.id === baseLayerIdValue ? "visible" : "none",
    );
  }
}

function baseStyle(): maplibregl.StyleSpecification {
  const activeBaseLayerId = selectedBaseLayerId.value;

  return {
    version: 8,
    sources: mapBaseLayers.reduce(
      (sources: Record<string, maplibregl.SourceSpecification>, provider) => {
        sources[baseSourceId(provider.id)] = {
          type: "raster",
          tiles: provider.tiles,
          tileSize: 256,
          attribution: provider.attribution,
        };
        return sources;
      },
      {},
    ),
    layers: mapBaseLayers.map((provider) => ({
      id: baseLayerId(provider.id),
      type: "raster",
      source: baseSourceId(provider.id),
      layout: {
        visibility: provider.id === activeBaseLayerId ? "visible" : "none",
      },
    })),
  } as maplibregl.StyleSpecification;
}

function getCogBaseUrl(): string | null {
  if (!props.displayRaster) return null;
  const datasetId = route.params.id;
  // Select Area has no variable route param; initialization selects the
  // dataset's default variable (or its first variable).
  const varId = route.params.variable ?? datasetStore.variable?.id;
  if (!datasetId || !varId) return null;
  return `${TILES_ENDPOINT}/${datasetId}/${varId}`;
}

// The API colours tiles from the variable's display entry, so the URL carries
// no colormap or rescale.
function getCogFullUrl(baseUrl: string, step: number) {
  return `${baseUrl}/${timestepKey(step)}/{z}/{x}/{y}`;
}

// Tiles are only requested inside the dataset's bbox, [west, south, east, north].
function getCogBounds(): number[] | undefined {
  return metadata.value?.bbox;
}

function addCogSlot(slot: typeof COG_A, step: number, opacity: number) {
  if (!map || !isMapLoaded || !cogBaseUrl.value) return;
  const url = getCogFullUrl(cogBaseUrl.value, step);
  const bounds = getCogBounds();
  map.addSource(slot.sourceId, {
    type: "raster",
    tiles: [url],
    tileSize: 128,
    ...(bounds && { bounds }),
  });
  map.addLayer(
    {
      id: slot.layerId,
      type: "raster",
      source: slot.sourceId,
      paint: {
        "raster-opacity": opacity,
        "raster-opacity-transition": { duration: 0 },
        "raster-fade-duration": 0,
      },
    },
    FILL_LAYER_ID,
  );
}

function removeCogSlot(slot: typeof COG_A) {
  if (!map) return;
  if (map.getLayer(slot.layerId)) map.removeLayer(slot.layerId);
  if (map.getSource(slot.sourceId)) map.removeSource(slot.sourceId);
}

function cancelPendingSwap() {
  if (pendingFrameCheck) {
    map?.off("render", pendingFrameCheck);
    pendingFrameCheck = null;
    pendingFrameSource = null;
    pendingFrameStep = null;
    removeCogSlot(cogBack); // discard the back buffer that was loading
  }
}

// Readiness belongs to the requested raster, not to unrelated basemap loads.
// A second render confirms the opacity swap before the plot advances.
function waitForFrame(slot: typeof COG_A, step: number, swap: boolean) {
  if (!map) return;
  pendingFrameSource = slot.sourceId;
  pendingFrameStep = step;
  isStepLoading.value = true;
  const check = () => {
    if (
      !map ||
      pendingFrameCheck !== check ||
      !map.isSourceLoaded(slot.sourceId)
    )
      return;
    map.off("render", check);
    if (swap) {
      map.setPaintProperty(slot.layerId, "raster-opacity", 0.7);
      removeCogSlot(cogFront);
      [cogFront, cogBack] = [cogBack, cogFront];
    }
    const displayed = () => {
      if (!map || pendingFrameCheck !== displayed) return;
      map.off("render", displayed);
      pendingFrameCheck = null;
      pendingFrameSource = null;
      pendingFrameStep = null;
      isStepLoading.value = false;
      emit("stepReady", step);
    };
    pendingFrameCheck = displayed;
    map.on("render", displayed);
    map.triggerRepaint();
  };
  pendingFrameCheck = check;
  map.on("render", check);
  map.triggerRepaint();
}

function addCogRasterLayer(step: number) {
  if (!map || !isMapLoaded || !cogBaseUrl.value) return;
  cancelPendingSwap();
  removeCogSlot(cogFront);
  removeCogSlot(cogBack);
  cogFront = COG_A;
  cogBack = COG_B;
  addCogSlot(cogFront, step, 0.7);
  waitForFrame(cogFront, step, false);
}

function removeCogRasterLayer() {
  if (!map || !isMapLoaded) return;
  cancelPendingSwap();
  removeCogSlot(cogFront);
  removeCogSlot(cogBack);
  isStepLoading.value = false;
}

function updateRasterLayer(step: number) {
  if (!map || !isMapLoaded || !cogBaseUrl.value) return;
  if (!map.getSource(cogFront.sourceId)) {
    addCogRasterLayer(step);
    return;
  }

  cancelPendingSwap();
  addCogSlot(cogBack, step, 0); // load invisibly
  waitForFrame(cogBack, step, true);
}

function mapExtentPolygon([west, south, east, north]: Bbox): any {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ],
        },
      },
    ],
  };
}

function normalizeGeoJson(geoJson: any): any {
  if (!geoJson) return null;
  if (geoJson.type === "FeatureCollection") return geoJson;
  if (geoJson.type === "Feature")
    return { type: "FeatureCollection", features: [geoJson] };
  if (geoJson.type && geoJson.coordinates) {
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: geoJson,
        },
      ],
    };
  }
  return null;
}

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
    | maplibregl.GeoJSONSource
    | undefined;
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

  const geoJsonToSync = geoJson;
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
  if (enabled) activeTool.value = tool;
  else if (activeTool.value === tool) activeTool.value = null;
}

// geoman emits every shape as standard GeoJSON; a circle arrives as a Polygon.
function handleGmCreate(event: any) {
  if (ignoreStoreWatch) return;

  const geoJson = event.feature?.getGeoJson?.();
  if (!geoJson) return;

  studyArea.save(geoJson);
  fitToGeoJson(geoJson);
}

function handleGmEditEnd(event: any) {
  if (ignoreStoreWatch) return;

  const geoJson = event.feature?.getGeoJson?.();
  if (!geoJson) return;

  studyArea.save(geoJson);
}

function handleGmRemove() {
  if (ignoreStoreWatch) return;
  studyArea.clear();
}

function addMetadataExtentLayer() {
  if (!map || !isMapLoaded || !metadata.value?.bbox) return;

  const sourceId = "dataset-region";
  const lineLayerId = "dataset-region-outline";

  if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
  if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
  if (map.getSource(sourceId)) map.removeSource(sourceId);

  map.addSource(sourceId, {
    type: "geojson",
    data: mapExtentPolygon(metadata.value.bbox),
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

function loadGeoJson(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  file.text().then((text) => {
    try {
      const geoJsonData = JSON.parse(text);
      studyArea.save(geoJsonData);
    } catch {
      alert("Sorry, we couldn't import this GeoJSON file.");
    }
  });
}

function selectGeoJsonFile() {
  document.getElementById("loadGeoJsonFile")?.click();
}

function exportSelectedGeometry() {
  const gJ = datasetStore.geoJson as any;
  if (!gJ) return;

  const convertedArea =
    "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(gJ));
  const button = document.getElementById("exportSelectedGeometry");
  if (!button) return;

  button.setAttribute("href", "data:" + convertedArea);
  button.setAttribute("download", `${metadata.value?.id}.geojson`);
}

onMounted(() => {
  if (!mapContainer.value) return;

  maplibregl.setWorkerUrl(mapWorkerUrl);
  const viewport = getInitialMapViewport(metadata.value);
  map = new maplibregl.Map({
    container: mapContainer.value,
    style: baseStyle(),
    minZoom: 2,
    ...("bbox" in viewport
      ? { bounds: viewport.bbox, fitBoundsOptions: { padding: 20 } }
      : {
          center: [viewport.center.lon, viewport.center.lat],
          zoom: viewport.zoom,
        }),
  });

  // No compass: the map isn't meant to be rotated, so it had nothing to reset.
  map.addControl(
    new maplibregl.NavigationControl({ showCompass: false }),
    "top-right",
  );
  map.addControl(
    {
      onAdd: () => {
        const el = document.createElement("div");
        el.className = "maplibregl-ctrl maplibregl-ctrl-group";
        basemapControlEl.value = el;
        return el;
      },
      onRemove: () => {
        basemapControlEl.value?.remove();
        basemapControlEl.value = null;
      },
    },
    "top-right",
  );
  map.addControl(new maplibregl.ScaleControl(), "bottom-right");
  map.on("error", (event: any) => {
    if (!pendingFrameSource || event.sourceId !== pendingFrameSource) return;
    const step = pendingFrameStep;
    cancelPendingSwap();
    isStepLoading.value = false;
    if (step != null) emit("stepError", step);
  });

  map.on("load", async () => {
    if (!map) return;
    isMapLoaded = true;

    addMetadataExtentLayer();
    studyArea.restore();

    addCogRasterLayer(props.step);

    if (isSelectArea.value) {
      // createGeomanInstance adds the controls itself; adding them again only
      // logs "controls already added".
      const geoman = await createGeomanInstance(map as any, GEOMAN_OPTIONS);
      // A quick return to visualize can remove this map while tools load.
      if (!map) {
        geoman.destroy();
        return;
      }
      gm = geoman;
      await syncDrawFromStore(datasetStore.geoJson);
      if (!map) return;

      (map as any).on("gm:create", handleGmCreate);
      (map as any).on("gm:editend", handleGmEditEnd);
      (map as any).on("gm:remove", handleGmRemove);
      // geoman's zoom has no maxZoom, so a point zoomed all the way in; zoom
      // again once its fit has started, capped like every other fit.
      (map as any).on("gm:globalzoom_to_featuresmodetoggled", (event: any) => {
        if (event.enabled) {
          setTimeout(() => fitToGeoJson(datasetStore.geoJson));
        }
      });
      (map as any).on("gm:globaldrawmodetoggled", (event: any) =>
        setActiveTool(event.shape, event.enabled),
      );
      // geoman names the change mode's event "edit".
      for (const [tool, eventMode] of Object.entries(EDIT_EVENT_MODES)) {
        (map as any).on(`gm:global${eventMode}modetoggled`, (event: any) =>
          setActiveTool(tool, event.enabled),
        );
      }
      map.on("mousemove", (event) => {
        drawPointer.value = { x: event.point.x, y: event.point.y };
      });
      map.on("mouseout", () => {
        drawPointer.value = null;
      });
    } else {
      updateStudyAreaDisplay(pendingStudyAreaGeoJson ?? datasetStore.geoJson);
      pendingStudyAreaGeoJson = null;
    }

    if (props.displayRaster) {
      if (legendOptions.value == null) {
        console.error(
          `Variable '${datasetStore.variable?.id}' has no continuous display range and colours (got ${JSON.stringify(datasetStore.variable?.display)}). Colorbar will not be shown.`,
        );
        messageStore.error(
          "The legend for this variable is missing or invalid, so it can't be displayed.",
        );
      } else {
        colorbar = new SkopeColorbar(legendOptions.value);
        // Keep the legend clear of the drawing tools on the selection map.
        map.addControl(
          colorbar,
          isSelectArea.value ? "bottom-right" : "bottom-left",
        );
      }
    }

    emit("mapReady", true);
  });
});

watch(
  () => datasetStore.geoJson,
  (geoJson: any) => {
    if (ignoreStoreWatch) return;
    if (isSelectArea.value) {
      void syncDrawFromStore(geoJson);
      return;
    }
    updateStudyAreaDisplay(geoJson);
  },
  { deep: true },
);

watch(
  () => metadata.value?.bbox,
  () => {
    addMetadataExtentLayer();
  },
);

watch(
  () => selectedBaseLayerId.value,
  (baseLayerIdValue: string) => {
    applyBaseLayerSelection(baseLayerIdValue);
  },
);

watch(
  () => props.step,
  (step: number) => {
    updateRasterLayer(step);
  },
);

watch(legendOptions, (options) => {
  if (options) colorbar?.update(options);
});

watch(legendVisible, (visible) => {
  if (visible) {
    colorbar?.show();
  } else {
    colorbar?.hide();
  }
});

watch(cogBaseUrl, (url) => {
  removeCogRasterLayer();
  if (url) {
    addCogRasterLayer(props.step);
  }
});

onUnmounted(() => {
  isMapLoaded = false;
  pendingStudyAreaGeoJson = null;
  if (pendingFrameCheck && map) {
    map.off("render", pendingFrameCheck);
    pendingFrameCheck = null;
  }
  if (gm) {
    gm.destroy();
    gm = null;
  }
  if (colorbar && map) {
    map.removeControl(colorbar);
    colorbar = null;
  }
  if (map) {
    map.remove();
    map = null;
  }
});
</script>

<style scoped>
#exportSelectedGeometry {
  text-decoration: none;
  color: inherit;
}

.map-card {
  display: flex;
  flex-direction: column;
}

/* Fill the space between the header and optional playback controls. */
.map {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  z-index: 1;
  overflow: visible;
}

.map-frame {
  position: relative;
  height: 100%;
  width: 100%;
}

.maplibre-map {
  height: 100%;
  width: 100%;
}

.draw-cursor-hint {
  position: absolute;
  z-index: 5;
  transform: translate(16px, 16px);
  max-width: 260px;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 12px;
  line-height: 1.4;
  pointer-events: none;
}

.map-step-loading {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.25);
  pointer-events: none;
}

.draw-callout {
  flex: 0 1 auto;
  min-width: 0;
  padding: 6px 10px;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
  font-size: 13px;
  line-height: 1.4;
}

/* Right-aligned, on its own line too when the header wraps. */
.geojson-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-left: auto;
}

@media (max-width: 599px) {
  .geojson-actions {
    width: 100%;
  }

  .geojson-actions > .v-btn {
    flex: 1 1 auto;
    min-height: 44px;
  }

  .map-frame {
    min-height: 380px;
  }
}

:deep(.maplibregl-ctrl-group) {
  margin-top: 8px;
}

:deep(.mapboxgl-ctrl-draw-btn) {
  min-width: 28px;
}

:deep(.skope-colorbar) {
  background: rgba(255, 255, 255, 0.88);
  border-radius: 4px;
  padding: 6px 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  pointer-events: none;
  font-size: 11px;
}

:deep(.skope-colorbar__units) {
  text-align: center;
  font-weight: 600;
  margin-bottom: 2px;
  font-size: 11px;
}
</style>
