<template>
  <v-container fluid class="fill-height align-start">
    <DatasetLoadState
      v-if="metadataState !== 'ready'"
      :state="metadataState"
      @retry="initializePage"
    />
    <template v-else>
      <SubHeader :select-variable="true">
        <v-btn
          v-if="canRetryTimeSeries"
          variant="outlined"
          @click="retryTimeSeries"
        >
          Retry time series
        </v-btn>
        <v-btn
          :to="editAreaLocation"
          variant="outlined"
          color="secondary"
          prepend-icon="mdi-vector-polygon"
        >
          Edit study area
        </v-btn>
        <v-btn
          :disabled="!hasValidStudyArea"
          :to="analyzeLocation"
          color="accent"
          variant="flat"
        >
          Analyze Data
          <v-icon class="ml-2" size="small"> mdi-chevron-right </v-icon>
        </v-btn>
      </SubHeader>
      <v-row class="pa-0 mb-6">
        <!-- 2 column layout with map and time series-->
        <v-col
          class="d-flex map-flex pa-0"
          cols="12"
          lg="6"
          align-self="stretch"
        >
          <Map
            :step="requestedStep"
            :preload-step="preloadStep"
            :display-raster="true"
            @step-ready="frameReady"
            @step-error="frameFailed"
          >
            <template #footer>
              <RasterPlaybackControls
                :step-selected="stepSelected"
                :is-playing="isPlaying"
                :can-play="canPlay"
                :is-step-loading="isStepLoading"
                @step-selected="setStep"
                @toggle-playback="togglePlay"
              />
            </template>
          </Map>
        </v-col>
        <!-- time series plot -->
        <v-col
          class="d-flex map-flex pa-0"
          cols="12"
          lg="6"
          align-self="stretch"
        >
          <TimeSeriesPlot
            :show-step-controls="true"
            :is-step-loading="isStepLoading"
            :traces="traces"
            :step-selected="stepSelected"
            @step-selected="setStep"
            @pause-playback="pause"
          />
        </v-col>
      </v-row>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted, onBeforeUnmount } from "vue";
import Map from "@/components/dataset/Map.client.vue";
import RasterPlaybackControls from "@/components/dataset/RasterPlaybackControls.vue";
import TimeSeriesPlot from "@/components/dataset/TimeSeriesPlot.vue";
import SubHeader from "@/components/dataset/SubHeader.vue";
import DatasetLoadState from "@/components/dataset/DatasetLoadState.vue";
import { axisYears } from "@/utils/timeAxis";
import { useRasterPlayback } from "@/composables/useRasterPlayback";
import { useAppStore } from "@/stores/app";
import { useDatasetStore } from "@/stores/dataset";
import { useMessagesStore } from "@/stores/messages";
import { useTimeSeriesRequest } from "@/composables/useTimeSeriesRequest";
import { useDatasetPage } from "@/composables/useDatasetPage";
import { useStudyArea } from "@/composables/useStudyArea";

definePageMeta({
  layout: "default",
  key: (route: any) => route.fullPath,
  middleware: ["requires-study-area"],
});

const route = useRoute();
const workflowDatasetId = String(route.params.id);
const appStore = useAppStore();
const datasetStore = useDatasetStore();
const messageStore = useMessagesStore();
const { state: metadataState, load: loadMetadata } = useDatasetPage(
  String(route.params.id),
  route.params.variable as string,
);
const studyArea = useStudyArea();
const { run: requestTimeSeries } = useTimeSeriesRequest("visualize");

const playbackYears = computed(() =>
  datasetStore.metadata?.time ? axisYears(datasetStore.metadata.time) : [],
);
const playbackRange = computed(
  () => datasetStore.temporalRange as [number, number],
);
const {
  requestedStep,
  preloadStep,
  displayedStep: stepSelected,
  isPlaying,
  isLoading: isStepLoading,
  canPlay,
  frameReady,
  selectStep,
  togglePlay,
  pause,
} = useRasterPlayback(
  playbackYears,
  playbackRange,
  datasetStore.temporalRangeMin,
);
let frameTimeout: ReturnType<typeof setTimeout> | undefined;
watch(
  [requestedStep, isStepLoading],
  () => {
    clearTimeout(frameTimeout);
    if (isStepLoading.value) {
      const step = requestedStep.value;
      frameTimeout = setTimeout(() => frameFailed(step), 30_000);
    }
  },
  { immediate: true },
);

function frameFailed(step: number) {
  if (step !== requestedStep.value) return;
  clearTimeout(frameTimeout);
  selectStep(stepSelected.value);
  messageStore.error(
    `Unable to load the map for ${step}. Playback paused. Try another year.`,
  );
}
let stopTimeSeriesWatch: (() => void) | null = null;

const hasValidStudyArea = computed(() => datasetStore.hasGeoJson);
// Omit navigation targets while their route parameters are unavailable.
const editAreaLocation = computed(() =>
  route.params.id
    ? {
        name: "dataset-id",
        params: { id: route.params.id },
        query: { returnTo: "visualize" },
      }
    : undefined,
);
const analyzeLocation = computed(() => {
  const { id, variable } = route.params;
  if (!id || !variable) return undefined;
  return { name: "dataset-id-analyze-variable", params: { id, variable } };
});
const canRetryTimeSeries = computed(
  () =>
    datasetStore.canHandleTimeSeriesRequest &&
    ["servererror", "timeout"].includes(
      datasetStore.timeSeriesRequestStatus.status,
    ),
);
const traces = computed(() => {
  const ts = datasetStore.timeseriesTrace;
  if (!ts) return [];
  return [{ ...ts, type: "scatter" }];
});

function setStep(step: number) {
  selectStep(step);
}

async function updateTimeSeries(data: any) {
  if (!datasetStore.canHandleTimeSeriesRequest) {
    datasetStore.setTimeSeriesNoArea();
    return;
  }
  await requestTimeSeries(data);
}

async function loadTimeSeries() {
  if (datasetStore.canHandleTimeSeriesRequest) {
    await updateTimeSeries(datasetStore.timeSeriesRequestData);
  }
}

async function retryTimeSeries() {
  if (!canRetryTimeSeries.value) return;
  await loadTimeSeries();
}

async function initializePage() {
  if (!(await loadMetadata())) return false;
  const savedStep = datasetStore.visualizeStep;
  selectStep(
    savedStep != null &&
      savedStep >= datasetStore.temporalRangeMin &&
      savedStep <= datasetStore.temporalRangeMax &&
      playbackYears.value.includes(savedStep)
      ? savedStep
      : datasetStore.temporalRangeMin,
  );
  return true;
}

await useAsyncData(
  `visualize-${route.params.id}-${route.params.variable}`,
  initializePage,
  { server: false },
);

onMounted(() => {
  document.addEventListener("visibilitychange", pauseWhenHidden);
  studyArea.restore();
  stopTimeSeriesWatch = watch(
    () => datasetStore.timeSeriesRequestData,
    async (data) => {
      if (data) {
        await updateTimeSeries(data);
      } else {
        await loadTimeSeries();
      }
    },
    { immediate: true },
  );
  appStore.setVisited();
});

onBeforeUnmount(() => {
  if (datasetStore.metadata?.id === workflowDatasetId) {
    datasetStore.visualizeStep = requestedStep.value;
  }
});

onUnmounted(() => {
  clearTimeout(frameTimeout);
  document.removeEventListener("visibilitychange", pauseWhenHidden);
  stopTimeSeriesWatch?.();
});

function pauseWhenHidden() {
  if (document.hidden) pause();
}
</script>

<style scoped>
/* The viewport less the app bar, step bar and page title, so the panels fit
   a laptop screen. A minimum, so the plot's column can grow to fit it. */
.map-flex {
  min-height: calc(100vh - 250px);
}

@media (min-width: 1200px) {
  .map-flex {
    /* Field + validation + padding + border: match the plot's natural height. */
    --panel-header-min-height: 93px;
    --panel-header-align: flex-start;
  }
}

@media all and (max-width: 960px) {
  .map-flex {
    min-height: 450px;
  }
}

@media all and (max-width: 600px) {
  .map-flex {
    min-height: 450px;
  }
}
</style>
