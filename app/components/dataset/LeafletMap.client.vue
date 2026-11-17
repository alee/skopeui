<template>
  <v-card
    class="pb-2"
    height="100%"
    width="100%"
    elevation="1"
    variant="outlined"
  >
    <v-toolbar variant="flat" class="ma-0 pa-0">
      <v-row class="mx-0" align="baseline">
        <v-spacer />
        <v-alert
          v-if="isSelectArea"
          density="compact"
          variant="tonal"
          icon="mdi-pencil"
          color="secondary"
          class="my-auto"
        >
          Use the draw toolbar on the left to select an area of study.
        </v-alert>
        <v-spacer />
        <!-- upload geojson -->
        <input
          id="loadGeoJsonFile"
          type="file"
          accept=".geojson"
          style="display: none"
          @change="loadGeoJson"
        >
        <v-tooltip location="bottom" text="Upload study area from GeoJSON">
          <template #activator="{ props }">
            <v-btn
              size="small"
              color="secondary"
              variant="outlined"
              v-bind="props"
              class="my-auto"
              @click="selectGeoJsonFile"
            >
              <v-icon>mdi-upload</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
        <!-- export geojson -->
        <v-tooltip location="bottom" text="Download selected area as GeoJSON">
          <template #activator="{ props }">
            <v-btn
              size="small"
              color="secondary"
              variant="flat"
              :disabled="!datasetStore.geoJson"
              v-bind="props"
              class="mx-2 my-auto"
              @click="exportSelectedGeometry"
            >
              <a id="exportSelectedGeometry">
                <v-icon>mdi-download</v-icon>
              </a>
            </v-btn>
          </template>
        </v-tooltip>
      </v-row>
    </v-toolbar>
    <!-- map -->
    <v-card-text class="map">
      <client-only placeholder="Loading map, please wait...">
        <l-map
          ref="layerMap"
          class="leaflet-map"
          :min-zoom="2"
          :zoom="initialCenter.zoom"
          :center="initialCenter.center"
          @ready="mapReady"
        >
          <l-tile-layer
            v-for="provider of leafletProviders"
            :key="provider.name"
            :url="provider.url"
            :name="provider.name"
            :attribution="provider.attribution"
            :visible="isVisible(provider)"
            layer-type="base"
          />
          <l-rectangle
            v-if="datasetBounds"
            :bounds="datasetBounds"
            :fill-opacity="defaultDatasetOpacity"
          />
          <l-control-layers
            v-if="showMapControls"
            :sort-layers="false"
            position="topright"
          />
          <l-control-scale position="bottomright" />
        </l-map>
      </client-only>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, watch, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { DEFAULT_BASEMAP, LEAFLET_PROVIDERS } from "@/store/modules/constants";
import circleToPolygon from "circle-to-polygon";
import { useStudyArea } from "@/composables/useStudyArea";
import { MAP_COLORS } from "@/utils/colors";
import {
  getInitialMapViewport,
  leafletBounds,
  leafletStartView,
} from "@/composables/useMapInitialViewport";
import { useAppStore } from "@/stores/app";
import { useDatasetStore } from "@/stores/dataset";

const props = defineProps({
  step: { type: Number, default: 2000 },
  displayRaster: { type: Boolean, default: true },
  circleToPolygonEdges: { type: Number, default: 32 },
});
const emit = defineEmits(["mapReady"]);

// Leaflet is provided by plugins/leaflet.client.ts (client-only).
// Captured once at setup; undefined on SSR but all leaflet code is client-side only.
const L: any = import.meta.client ? (useNuxtApp() as any).$L : null;

const route = useRoute();
const appStore = useAppStore();
const datasetStore = useDatasetStore();
const studyArea = useStudyArea();

// Reactive UI state
const defaultDatasetOpacity = 0.0;
const defaultBoundsPadding: [number, number] = [3, 3];

// Non-reactive mutable Leaflet state (plain variables – deliberately not reactive
// so Vue does not instrument Leaflet objects).
let leafletMap: any = null;
let drawnItems: any = null;
let drawControlFull: any = null;
let drawControlEditOnly: any = null;
let stopGeoJsonWatch: (() => void) | null = null;

// Computeds
const stepNames = computed(() => appStore.stepNames);
const metadata = computed(() => datasetStore.metadata);
const currentStep = computed(() =>
  stepNames.value.findIndex((x: unknown) => x === route.name),
);
const showMapControls = computed(() => currentStep.value >= 1);
const initialMapViewport = computed(() =>
  getInitialMapViewport(metadata.value),
);
const initialCenter = computed(() =>
  leafletStartView(initialMapViewport.value),
);
const datasetBounds = computed(() =>
  metadata.value?.bbox ? leafletBounds(metadata.value.bbox) : null,
);
const leafletProviders = LEAFLET_PROVIDERS;
const isSelectArea = computed(() => currentStep.value === 1);
const isVisualize = computed(() => currentStep.value === 2);
const areaStyle = computed(() => ({
  fill: !isVisualize.value,
  fillColor: MAP_COLORS.studyArea,
  fillOpacity: 0.1,
  stroke: true,
  weight: 3,
  opacity: 1,
  color: MAP_COLORS.studyArea,
}));

function isVisible(provider: any) {
  return provider.name === DEFAULT_BASEMAP;
}

function addDrawToolbar(map: any) {
  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);
  drawControlFull = new L.Control.Draw({
    position: "topleft",
    draw: {
      polyline: false,
      circlemarker: false,
      rectangle: { shapeOptions: { color: MAP_COLORS.studyArea }, metric: ["km"] },
      circle: { shapeOptions: { color: MAP_COLORS.studyArea }, metric: ["km"] },
      polygon: {
        shapeOptions: { color: MAP_COLORS.studyArea },
        metric: ["km"],
        showArea: true,
        showLength: true,
      },
    },
    edit: { featureGroup: drawnItems },
  });
  drawControlEditOnly = new L.Control.Draw({
    edit: { featureGroup: drawnItems },
    draw: false,
  });
  const drawControlButtons = L.drawLocal.draw.toolbar.buttons;
  drawControlButtons.marker = "Select a point";
  drawControlButtons.polygon = "Select a polygon area";
  drawControlButtons.circle = "Select a circular area";
  drawControlButtons.rectangle = "Select a rectangular area";
  const editControlButtons = L.drawLocal.edit.toolbar.buttons;
  editControlButtons.edit = "Edit spatial selection";
  editControlButtons.editDisabled = "No spatial selection to edit";
  editControlButtons.remove = "Clear spatial selection";
  editControlButtons.removeDisabled = "No spatial selection to remove";
  map.addControl(drawControlFull);
}

function disableEditOnly(map: any) {
  if (!map) return;
  map.removeControl(drawControlEditOnly);
  drawControlFull.addTo(map);
}

function enableEditOnly(map: any) {
  if (!map) return;
  map.removeControl(drawControlFull);
  drawControlEditOnly.addTo(map);
}

function toLeafletLayer(geoJsonData: any) {
  return L.geoJSON(geoJsonData, {
    pointToLayer: (_feature: any, latlng: any) => {
      if (_feature.properties.radius) {
        return new L.Circle(latlng, _feature.properties.radius);
      }
      return new L.Marker(latlng);
    },
    style: areaStyle.value,
  });
}

function renderSelectedArea(geoJsonData: any, map?: any) {
  const resolvedMap = map || leafletMap;
  const geoJsonLayer = toLeafletLayer(geoJsonData);
  geoJsonLayer.eachLayer((l: any) => drawnItems.addLayer(l));
  enableEditOnly(resolvedMap);
  let padding = [...defaultBoundsPadding] as [number, number];
  if (geoJsonLayer instanceof L.Marker) {
    padding = padding.map((x) => x * 15) as [number, number];
  }
  resolvedMap.fitBounds(geoJsonLayer.getBounds(), { padding });
}

function saveGeometry(layer: any) {
  const geoJsonData = layer.toGeoJSON();
  if (layer instanceof L.Circle) {
    geoJsonData.properties.radius = layer.getRadius();
    geoJsonData.geometry = circleToPolygon(
      geoJsonData.geometry.coordinates,
      layer.getRadius(),
      props.circleToPolygonEdges,
    );
  }
  studyArea.save(geoJsonData);
}

function registerToolbarHandlers(map: any) {
  map.on(L.Draw.Event.EDITED, (layerGroup: any) => {
    layerGroup.layers.eachLayer((layer: any) => saveGeometry(layer));
  });
  map.on(L.Draw.Event.CREATED, (event: any) => {
    saveGeometry(event.layer);
    enableEditOnly(map);
  });
  map.on(L.Draw.Event.DELETED, () => {
    studyArea.clear();
    if (drawnItems.getLayers().length === 0) disableEditOnly(map);
  });
}

function mapReady(map: any) {
  leafletMap = map;
  const viewport = initialMapViewport.value;
  if ("bbox" in viewport) map.fitBounds(leafletBounds(viewport.bbox));
  // Leaflet can calculate a stale size when mounted in flex/grid layouts; force recalc.
  requestAnimationFrame(() => map.invalidateSize(true));
  addDrawToolbar(map);
  studyArea.restore();
  registerToolbarHandlers(map);
  // Mirror original $watch("geoJson", ..., { immediate: true }) called in mapReady.
  // Must be stopped manually (created outside a lifecycle hook).
  stopGeoJsonWatch = watch(
    () => datasetStore.geoJson,
    (gJ: any) => {
      drawnItems.clearLayers();
      if (gJ === null) {
        disableEditOnly(map);
      } else {
        renderSelectedArea(gJ, map);
      }
    },
    { immediate: true },
  );
  emit("mapReady", true);
}

function loadGeoJson(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  file.text().then((text) => {
    try {
      const geoJsonData = JSON.parse(text);
      studyArea.save(geoJsonData);
    } catch (error) {
      console.error(error);
      alert("Sorry, we couldn't import this GeoJSON file: " + text);
    }
  });
}

function selectGeoJsonFile() {
  document.getElementById("loadGeoJsonFile")?.click();
}

function exportSelectedGeometry() {
  const gJ = datasetStore.geoJson as any;
  if (gJ) {
    const convertedArea =
      "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(gJ));
    const button = document.getElementById("exportSelectedGeometry");
    if (button) {
      button.setAttribute("href", "data:" + convertedArea);
      button.setAttribute("download", `${(metadata.value as any)?.id}.geojson`);
    }
  }
}

onUnmounted(() => {
  stopGeoJsonWatch?.();
});
</script>
<style>
.leaflet-top.leaflet-right
  .leaflet-control-layers:nth-child(1)
  .leaflet-control-layers-toggle {
  background-image: url(/earth.svg);
}

#exportSelectedGeometry {
  text-decoration: none;
  color: inherit;
}

.map {
  height: calc(95% - 48px);
  position: relative;
  z-index: 1;
}

.leaflet-map {
  height: 100%;
  width: 100%;
}

.leaflet-map .leaflet-container {
  height: 100%;
  width: 100%;
}

ul.leaflet-draw-actions.leaflet-draw-actions-bottom li a[title="Save changes"] {
  display: none;
}
</style>
