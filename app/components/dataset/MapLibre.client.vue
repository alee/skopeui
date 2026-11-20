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
          :disabled="!datasetStore.hasGeoJson"
          prepend-icon="mdi-download"
          @click="exportSelectedGeometry"
        >
          Download GeoJSON
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
              <v-icon size="18"> mdi-layers-outline </v-icon>
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
          aria-label="Loading map"
          indeterminate
          color="primary"
          size="48"
          width="4"
        />
      </div>
    </v-card-text>
    <div ref="attributionContainer" class="map-attribution" />
    <slot name="footer" />
  </v-card>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { setWorkerUrl } from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import "@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css";
import AreaReadout from "@/components/dataset/AreaReadout.vue";
import PanelHeader from "@/components/dataset/PanelHeader.vue";
import type { ColorbarOptions } from "@/utils/skopeColorbar";
import { createApiEndpoints } from "@/utils/apiEndpoints";
import { useStudyArea } from "@/composables/useStudyArea";
import { useAppStore } from "@/stores/app";
import { useDatasetStore } from "@/stores/dataset";
import { useMessagesStore } from "@/stores/messages";
import { parseImportedStudyArea } from "@/utils/studyArea";
import { getBasemaps, DEFAULT_BASEMAP_ID } from "@/utils/maplibre/basemaps";
import { createMapScene } from "@/utils/maplibre/scene";
import { createRasterController } from "@/utils/maplibre/raster";
import { createStudyAreaController } from "@/utils/maplibre/studyArea";
import {
  DRAW_CALLOUT,
  EDIT_CALLOUT,
  TOOL_INSTRUCTIONS,
} from "@/utils/maplibre/config";

const props = defineProps({
  step: { type: Number, default: 2000 },
  preloadStep: { type: [Number, null], default: null },
  displayRaster: { type: Boolean, default: true },
});
const emit = defineEmits(["mapReady", "stepReady", "stepError"]);
const route = useRoute();
const appStore = useAppStore();
const datasetStore = useDatasetStore();
const messageStore = useMessagesStore();
const studyArea = useStudyArea();
const { $download } = useNuxtApp();
const runtimeConfig = useRuntimeConfig();
const endpoints = createApiEndpoints(runtimeConfig.public.apiBase);
const mapBaseLayers = getBasemaps(runtimeConfig.public);
const defaultBaseLayer = mapBaseLayers.find(
  (layer) => layer.id === DEFAULT_BASEMAP_ID,
);
const mapContainer = ref<HTMLElement | null>(null);
const attributionContainer = ref<HTMLElement | null>(null);
const isStepLoading = ref(false);
const metadata = computed(() => datasetStore.metadata);
const currentStep = computed(() =>
  appStore.stepNames.findIndex((step: unknown) => step === route.name),
);
const isSelectArea = computed(() => currentStep.value === 1);
const activeTool = ref<string | null>(null);
const cursorHint = computed(
  () => activeTool.value && TOOL_INSTRUCTIONS[activeTool.value],
);
const drawPointer = ref<{ x: number; y: number } | null>(null);
const selectedBaseLayerId = ref(defaultBaseLayer?.id ?? "");
const basemapControlEl = ref<HTMLElement | null>(null);
const baseLayerOptions = mapBaseLayers.map((provider) => ({
  title: provider.name,
  value: provider.id,
}));
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

const raster = createRasterController({
  baseUrl: () => cogBaseUrl.value,
  bounds: () => metadata.value?.bbox,
  displayRaster: () => props.displayRaster,
  legendOptions: () => legendOptions.value,
  legendPosition: () => (isSelectArea.value ? "bottom-right" : "bottom-left"),
  onInvalidLegend: () => {
    console.error(
      `Variable '${datasetStore.variable?.id}' has no continuous display range and colours (got ${JSON.stringify(datasetStore.variable?.display)}). Colorbar will not be shown.`,
    );
    messageStore.error(
      "The legend for this variable is missing or invalid, so it can't be displayed.",
    );
  },
  onLoading: (loading) => {
    isStepLoading.value = loading;
  },
  onReady: (step) => emit("stepReady", step),
  onError: (step) => emit("stepError", step),
});
const drawing = createStudyAreaController({
  editable: () => isSelectArea.value,
  geometry: () => datasetStore.geoJson,
  save: studyArea.save,
  clear: studyArea.clear,
  onTool: (tool) => {
    activeTool.value = tool;
  },
  onPointer: (point) => {
    drawPointer.value = point;
  },
});
const scene = createMapScene({
  attributionContainer: () => attributionContainer.value,
  baseLayers: mapBaseLayers,
  metadata: () => metadata.value,
  selectedBaseLayerId: () => selectedBaseLayerId.value,
  onBasemapControl: (element) => {
    basemapControlEl.value = element;
  },
  onLoad: async (map) => {
    studyArea.restore();
    raster.initialize(map, props.step);
    if (!(await drawing.initialize(map)) || !scene.isReady()) return;
    raster.initializeLegend();
    emit("mapReady", true);
  },
  beforeRemove: () => {
    drawing.dispose();
    raster.dispose();
  },
});

function getCogBaseUrl(): string | null {
  if (!props.displayRaster) return null;
  const datasetId = route.params.id;
  // Select Area has no variable route param; initialization selects the
  // dataset's default variable (or its first variable).
  const varId = route.params.variable ?? datasetStore.variable?.id;
  if (!datasetId || !varId) return null;
  return `${endpoints.tiles}/${datasetId}/${varId}`;
}

let importSequence = 0;
let disposed = false;

async function loadGeoJson(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  input.value = "";
  const sequence = ++importSequence;
  const datasetId = route.params.id;
  const isCurrent = () =>
    !disposed && sequence === importSequence && route.params.id === datasetId;
  try {
    const text = await file.text();
    if (!isCurrent()) return;
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("The file is not valid JSON. Choose a GeoJSON file.");
    }
    const feature = parseImportedStudyArea(data);
    studyArea.save(feature);
  } catch (error) {
    if (!isCurrent()) return;
    messageStore.error(
      `Unable to import the study area. ${error instanceof Error ? error.message : "The file could not be read. Please choose it again."} Your current selection has been kept.`,
    );
  }
}

function selectGeoJsonFile() {
  document.getElementById("loadGeoJsonFile")?.click();
}

function exportSelectedGeometry() {
  if (!datasetStore.hasGeoJson) return;
  $download.saveAs(
    new Blob([JSON.stringify(datasetStore.geoJson)], {
      type: "application/geo+json;charset=utf-8",
    }),
    `${metadata.value?.id}.geojson`,
  );
}

onMounted(() => {
  if (!mapContainer.value) return;
  setWorkerUrl(mapWorkerUrl);
  scene.mount(mapContainer.value);
});
onUnmounted(() => {
  disposed = true;
  scene.dispose();
});
watch(
  () => datasetStore.geoJson,
  (geometry) => drawing.updateGeometry(geometry),
  { deep: true },
);
watch(
  () => metadata.value?.bbox,
  () => scene.updateExtent(),
);
watch(selectedBaseLayerId, (id) => scene.selectBaseLayer(id));
watch(
  () => [props.step, props.preloadStep] as const,
  ([step, preloadStep], [previousStep]) => {
    // Commit first so clearing lookahead cannot discard the requested buffer.
    if (step !== previousStep) raster.updateStep(step);
    raster.preloadStep(preloadStep);
  },
);
watch(legendOptions, (options) => raster.updateLegend(options));
watch(legendVisible, (visible) => raster.setLegendVisible(visible));
watch(cogBaseUrl, () => raster.reset(props.step));
</script>

<style scoped>
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
    min-height: 480px;
  }

  :deep(.maplibregl-ctrl-group button) {
    width: 44px;
    height: 44px;
  }
}

:deep(.maplibregl-ctrl-group) {
  margin-top: 8px;
}

.map-attribution {
  flex: 0 0 auto;
  padding: 0 16px 12px;
  font-size: 12px;
  line-height: 1.5;
}

.map-attribution :deep(.maplibregl-ctrl-attrib) {
  margin: 0;
  float: none;
  padding: 0;
  background: transparent;
  overflow-wrap: anywhere;
}

.map-attribution :deep(a) {
  text-decoration: underline;
  text-underline-offset: 2px;
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
