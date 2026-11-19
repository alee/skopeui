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
          :to="visualizeLocation"
          variant="outlined"
          color="secondary"
          prepend-icon="mdi-chevron-left"
        >
          Back to visualize
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
          color="accent"
          variant="flat"
          :disabled="!canExport"
          :loading="isExporting"
          @click="exportData"
        >
          Download
          <v-icon class="ml-2" size="small">mdi-download</v-icon>
        </v-btn>
      </SubHeader>
      <v-row>
        <!-- time series -->
        <v-col class="d-flex timeseries-flex" cols="12" lg="8">
          <TimeSeriesPlot
            ref="plot"
            :show-area="true"
            :show-step-controls="false"
            :traces="traces"
            :y-axis-label="yAxisLabel"
            @plot-ready="isPlotReady = $event"
            @selected-temporal-range="updateTimeSeries"
          />
        </v-col>
        <!-- analysis form -->
        <v-col cols="12" lg="4" class="stats-form">
          <v-form
            ref="analysisRequestForm"
            v-model="analysisFormValid"
            class="pa-3 bg-grey-lighten-3"
            :class="{ 'mt-10': mdAndDown }"
          >
            <span class="subtitle">Statistics for the Temporal Interval</span>
            <v-data-table
              class="stats-table"
              density="compact"
              :items-per-page="-1"
              :headers="statisticsHeaders"
              hide-default-footer
              :items="summaryStatistics"
            />
            <v-select
              v-model="zonalStatistic"
              class="mt-3"
              :items="zonalStatisticOptions"
              item-color="primary"
              item-title="label"
              item-value="id"
              label="For each time step, summarize selected area as"
              hint="Summary value of all selected pixels at each time step"
              :disabled="!isStudyAreaPolygon"
            />
            <!-- /////////// TRANSFORMATION OPTIONS /////////// -->
            <v-select
              v-model="transformOption"
              :items="transformItems"
              color="secondary"
              item-color="secondary"
              item-title="label"
              item-value="id"
              label="Select a transformation option"
              :hint="transformHint(transformOption)"
            />
            <template v-if="transformOption !== 'none'">
              <v-row
                v-if="transformOption === 'zscoreFixed'"
                align="baseline"
                justify="start"
                no-gutters
                class="mt-2"
              >
                <v-col class="mr-5">
                  <v-text-field
                    v-model="timeRange.lb.year"
                    density="compact"
                    variant="outlined"
                    label="Year (Lower Bound)"
                    type="number"
                    :rules="[validateMinYear]"
                  />
                </v-col>
                <v-col>
                  <v-text-field
                    v-model="timeRange.ub.year"
                    density="compact"
                    variant="outlined"
                    label="Year (Upper Bound)"
                    type="number"
                    :rules="[validateMaxYear]"
                  />
                </v-col>
              </v-row>
              <v-text-field
                v-if="transformOption === 'zscoreMoving'"
                v-model="zScoreMovingIntervalTimeSteps"
                density="compact"
                label="Transform window"
                variant="outlined"
                class="mt-2"
                suffix="time steps"
                type="number"
                :rules="[validateZScoreWidth]"
              />
            </template>
            <v-select
              v-model="smoothingOption"
              :items="smoothingOptions"
              color="primary"
              item-color="secondary"
              item-title="label"
              item-value="id"
              label="Select a smoothing option"
              :hint="smoothingHint(smoothingOption)"
              class="mt-3"
            />
            <v-text-field
              v-if="hasSmoothingOption"
              v-model="smoothingTimeStep"
              density="compact"
              variant="outlined"
              class="mt-2"
              label="Smoothing window"
              suffix="time steps"
              type="number"
              :rules="[validateSmoothingWidth]"
            />
            <v-row>
              <v-col>
                <v-btn @click="clearTransformedTimeSeries">Clear</v-btn>
              </v-col>
              <v-col align="end">
                <v-btn
                  :disabled="!analysisFormValid"
                  class="font-weight-bold"
                  color="accent"
                  @click="updateTimeSeries"
                  >Update
                </v-btn>
              </v-col>
            </v-row>
          </v-form>
        </v-col>
      </v-row>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import {
  ref,
  reactive,
  toRefs,
  nextTick,
  computed,
  watch,
  onBeforeUnmount,
} from "vue";
import { useMounted, whenever } from "@vueuse/core";
import { useDisplay } from "vuetify";
import type { VForm } from "vuetify/components";
import TimeSeriesPlot from "@/components/dataset/TimeSeriesPlot.vue";
import SubHeader from "@/components/dataset/SubHeader.vue";
import DatasetLoadState from "@/components/dataset/DatasetLoadState.vue";
import { extractYear, toISODate } from "@/utils/stats";
import {
  defaultAnalysisForm,
  analysisOptionsFromForm,
  analysisFormFromRequest,
  transformOptionFor,
  SMOOTHING_OPTIONS,
  TRANSFORM_OPTIONS,
} from "@/utils/analysisOptions";
import type { TimeSeriesPlotApi } from "@/types/plot";
import type { DraftTimeseriesRequest } from "@/types/api";
import { buildReadme } from "@/utils/buildReadme";
import { useAnalysisStore } from "@/stores/analysis";
import { useDatasetStore } from "@/stores/dataset";
import { useTimeSeriesRequest } from "@/composables/useTimeSeriesRequest";
import { useDatasetPage } from "@/composables/useDatasetPage";
import { useStudyArea } from "@/composables/useStudyArea";
import { captureAnalysisExport } from "@/utils/analysisExport";
import { useMessagesStore } from "@/stores/messages";
import JSZip from "jszip";
import Papa from "papaparse";

definePageMeta({ layout: "default", middleware: ["requires-study-area"] });

const { buildId } = useAppConfig();
const route = useRoute();
// Capture the route key before navigation changes the reactive route object.
const draftKey = `${route.params.id}:${route.params.variable}`;
const visualizeLocation = computed(() => {
  const { id, variable } = route.params;
  return id && variable
    ? { name: "dataset-id-visualize-variable", params: { id, variable } }
    : undefined;
});
const editAreaLocation = computed(() =>
  route.params.id
    ? {
        name: "dataset-id",
        params: { id: route.params.id },
        query: { returnTo: "analyze" },
      }
    : undefined,
);
const { mdAndDown } = useDisplay();
const analysisStore = useAnalysisStore();
const datasetStore = useDatasetStore();
const { state: metadataState, load: loadMetadata } = useDatasetPage(
  String(route.params.id),
  route.params.variable as string,
);
const studyArea = useStudyArea();
const { run: requestTimeSeries } = useTimeSeriesRequest("analyze");
const { $download } = useNuxtApp();

const plot = ref<TimeSeriesPlotApi | null>(null);
const isPlotReady = ref(false);
const isExporting = ref(false);
const exportMessages = useMessagesStore();
const canExport = computed(
  () =>
    analysisStore.hasCurrentResult && isPlotReady.value && !isExporting.value,
);
function copyFormDraft(draft: ReturnType<typeof defaultAnalysisForm>) {
  return {
    ...draft,
    timeRange: { lb: { ...draft.timeRange.lb }, ub: { ...draft.timeRange.ub } },
  };
}
const form = reactive(defaultAnalysisForm());
const {
  zonalStatistic,
  smoothingOption,
  smoothingTimeStep,
  transformOption,
  timeRange,
  zScoreMovingIntervalTimeSteps,
} = toRefs(form);
const analysisFormValid = ref(true);
// Labels follow the displayed response, including when a later request fails.
const yAxisLabel = computed(() => {
  const response = analysisStore.response;
  const completed = analysisStore.completedRequest;
  if (!response?.series.length || !completed) return "";
  const transform = transformOptionFor(
    response.transform,
    completed.time_range,
  );
  if (transform === "none") return "";
  if (transform === "zscoreSelected") {
    const start = extractYear(completed.time_range.gte);
    const end = extractYear(completed.time_range.lte);
    const fullRecord =
      start === datasetStore.minYear && end === datasetStore.maxYear;
    return `Z-Score wrt ${fullRecord ? "full record" : "selected interval"} (${start}–${end})`;
  }
  return (
    TRANSFORM_OPTIONS.find((option) => option.id === transform)?.label ?? ""
  );
});

const zonalStatisticOptions = [
  { label: "Mean of its pixels", id: "mean" },
  { label: "Median of its pixels", id: "median" },
];
// Fixed column widths, so the table keeps its size whatever the values.
const statisticsHeaders = [
  { title: "Series", align: "start", key: "name", width: "31%" },
  { title: "Mean", align: "end", key: "mean", width: "23%" },
  { title: "Median", align: "end", key: "median", width: "23%" },
  { title: "Std. dev.", align: "end", key: "stdev", width: "23%" },
] as const;
const transformOptions = TRANSFORM_OPTIONS;
const smoothingOptions = SMOOTHING_OPTIONS;

const temporalRange = computed(() => datasetStore.temporalRange);
// The "selected interval" z-score uses the range on screen as its reference,
// so its label names that range.
const transformItems = computed(() =>
  transformOptions.map((option) => {
    if (option.id !== "zscoreSelected") return option;
    const [start, end] = temporalRange.value;
    const isFullRecord =
      start === datasetStore.minYear && end === datasetStore.maxYear;
    return {
      ...option,
      label: isFullRecord
        ? `Z-Score wrt full record (${start}–${end})`
        : `Z-Score wrt selected interval (${start}–${end})`,
    };
  }),
);
const minYear = computed(() => datasetStore.minYear);
const maxYear = computed(() => datasetStore.maxYear);
const studyAreaGeoJson = computed(() => datasetStore.geoJson);
const hasSmoothingOption = computed(() => smoothingOption.value !== "none");
const isStudyAreaPolygon = computed(() => {
  const geojson = studyAreaGeoJson.value as any;
  if (!geojson) return false;
  const polygons = ["Polygon", "MultiPolygon"];
  switch (geojson.type) {
    case "Polygon":
    case "MultiPolygon":
      return true;
    case "Feature":
      return polygons.includes(geojson.geometry.type);
    case "FeatureCollection":
      for (const feature of geojson.features) {
        if (polygons.includes(feature.geometry.type)) return true;
      }
      return false;
    default:
      return false;
  }
});
// The API's statistics only: until /analyze answers, the table is empty.
const summaryStatistics = computed(() => analysisStore.summaryStatistics);
const traces = computed(() => {
  const timeseries = analysisStore.timeseries;
  const transformed = timeseries.map((ts) => ({
    ...ts,
    type: "scatter" as const,
  }));
  if (transformed.length > 0) return transformed;
  return [
    { ...datasetStore.filteredTimeSeries(), type: "scatter", name: "Original" },
  ];
});
const formOptions = computed(() =>
  analysisOptionsFromForm(form, temporalRange.value),
);

function transformHint(transform: string) {
  switch (transform) {
    case "zscoreFixed":
      return "Displays Z-score transformed values relative to a fixed interval selected by the user";
    case "zscoreMoving":
      return "Displays Z-score transformed values relative to a moving window of a size (N time steps) selected by the user";
    case "zscoreSelected":
      return "Displays Z-score transformed values relative to the time range shown in the plot";
    default:
      return "Modeled values are graphed without any transformation";
  }
}

function smoothingHint(smooth: string) {
  switch (smooth) {
    case "centeredAverage":
      return `Plots the ${zonalStatistic.value} of the current years and the previous and successive (N-1)/2 years where N = odd window width`;
    case "trailingAverage":
      return `Plots the ${zonalStatistic.value} of the current year and the N-1 preceding years where N = window width`;
    default:
      return "No smoothing the summary values for a given year are graphed";
  }
}

async function retrieveAnalysis(data: Partial<DraftTimeseriesRequest>) {
  // Like visualize: say there's no area instead of leaving a blank plot.
  if (!data.selected_area) {
    datasetStore.setTimeSeriesNoArea();
    return;
  }
  if (Object.values(data).some((v) => v == undefined)) return;
  await requestTimeSeries(data as DraftTimeseriesRequest);
}

function initializeRequestData() {
  const incoming: DraftTimeseriesRequest = {
    ...datasetStore.defaultApiRequestData,
  };
  const existing = analysisStore.requestData;
  if (existing?.transform) incoming.transform = existing.transform;
  if (existing?.zonal_statistic)
    incoming.zonal_statistic = existing.zonal_statistic;
  if (existing?.requested_series_options)
    incoming.requested_series_options = existing.requested_series_options;
  analysisStore.setDefaultRequestData(incoming);
  return incoming;
}

function initializeFormData(request: Partial<DraftTimeseriesRequest>) {
  Object.assign(form, analysisFormFromRequest(form, request));
}

function clearTransformedTimeSeries() {
  smoothingOption.value = "none";
  transformOption.value = "none";
  analysisStore.setDefaultRequestData(datasetStore.defaultApiRequestData);
}

async function exportData() {
  if (!canExport.value || !analysisStore.completedRequest) return;
  isExporting.value = true;
  try {
    const snapshot = captureAnalysisExport(
      analysisStore.completedRequest,
      analysisStore.response,
    );
    // The plot captures its data and current zoom synchronously before rendering either image.
    if (!plot.value) throw new Error("The plot is not ready for export.");
    const plotImages = await plot.value.getTimeSeriesPlotImage(snapshot.traces);
    const [png, svg] = await Promise.all([
      fetch(plotImages.png).then((image) => image.blob()),
      fetch(plotImages.svg).then((image) => image.blob()),
    ]);
    const zip = new JSZip();
    zip.file("skope-request.json", JSON.stringify(snapshot.request));
    zip.file(
      "summary-statistics.json",
      JSON.stringify(snapshot.summaryStatistics),
    );
    zip.file("time-series.json", JSON.stringify(snapshot.traces));
    zip.file("time-series.csv", Papa.unparse(snapshot.rows));
    zip.file("plot.png", png);
    zip.file("plot.svg", svg);
    zip.file(
      "study-area.geojson",
      JSON.stringify(snapshot.request.selected_area),
    );
    zip.file("README.md", buildReadme(snapshot.request, buildId));
    const content = await zip.generateAsync({ type: "blob" });
    $download.saveAs(
      content,
      `${snapshot.request.dataset_id}_${snapshot.request.variable_id}.zip`,
    );
  } catch (error) {
    console.error("Unable to export analysis", error);
    exportMessages.error("Unable to prepare the download. Please try again.");
  } finally {
    isExporting.value = false;
  }
}

async function updateTimeSeries() {
  if (
    !analysisFormValid.value ||
    datasetStore.timeSeriesRequestStatus.status === "loading"
  )
    return;
  const requestData: DraftTimeseriesRequest = {
    ...datasetStore.defaultApiRequestData,
    ...formOptions.value,
    time_range: {
      gte: toISODate(temporalRange.value[0]),
      lte: toISODate(temporalRange.value[1]),
    },
  };
  analysisStore.setRequestData(requestData);
}

// A z-score needs at least two values to have a spread to divide by.
function validateMinYear(value: number | string) {
  const year = Number(value);
  if (year < minYear.value) return `Please enter a min year > ${minYear.value}`;
  if (year > maxYear.value)
    return `Please enter a min year <= ${maxYear.value}`;
  if (Number(year) >= Number(timeRange.value.ub.year))
    return "Please enter a min year before the max year";
  return true;
}

function validateMaxYear(value: number | string) {
  const year = Number(value);
  if (year < minYear.value) return `Please enter a max year > ${minYear.value}`;
  if (year > maxYear.value)
    return `Please enter a max year <= ${maxYear.value}`;
  if (Number(year) <= Number(timeRange.value.lb.year))
    return "Please enter a max year after the min year";
  return true;
}

// The dataset's number of time steps bounds every moving window.
const timestepCount = computed(
  () => datasetStore.metadata?.time.count ?? Infinity,
);

function validateZScoreWidth(width: number) {
  // Only the last time step has count - 1 steps before it.
  const steps = Number(width);
  const max = timestepCount.value - 1;
  if (!Number.isInteger(steps) || steps < 2 || steps > max)
    return `Please enter a whole number from 2 to ${max}`;
  return true;
}

// Each year's rule compares it with the other year: check both when either
// changes, so fixing one clears the other's message.
const analysisRequestForm = ref<InstanceType<typeof VForm> | null>(null);
watch(
  () => [timeRange.value.lb.year, timeRange.value.ub.year],
  () => analysisRequestForm.value?.validate(),
);

function validateSmoothingWidth(windowSize: number) {
  const steps = Number(windowSize);
  if (!Number.isInteger(steps) || steps < 1 || steps > timestepCount.value)
    return `Please enter a whole number from 1 to ${timestepCount.value}`;
  if (smoothingOption.value === "trailingAverage") return true;
  if (steps % 2 === 0) return "Please enter an odd window size";
  return true;
}

watch(
  () => analysisStore.requestData,
  async (data) => {
    if (!data) return;
    initializeFormData(data);
    await retrieveAnalysis(data);
  },
);

async function initializePage() {
  if (!(await loadMetadata())) return false;
  timeRange.value.lb.year = datasetStore.minYear;
  timeRange.value.ub.year = datasetStore.maxYear;
  return true;
}

await useAsyncData(
  `analyze-${route.params.id}-${route.params.variable}`,
  initializePage,
  { server: false },
);

// The first request needs the dataset's metadata, and the study area that's
// saved under the dataset's ID. On a fresh page load the metadata arrives
// after mounting, so start once both have happened.
const isMounted = useMounted();
whenever(
  () => isMounted.value && datasetStore.metadata != null,
  async () => {
    studyArea.restore();
    const requestData = initializeRequestData();
    initializeFormData(requestData);
    // Let the applied-request watcher run before restoring unsubmitted edits.
    await nextTick();
    const draft = analysisStore.formDrafts?.[draftKey];
    if (draft) Object.assign(form, copyFormDraft(draft));
  },
  { once: true },
);
// Keep raw form input, including inactive windows and unsubmitted edits,
// separate from the validated options used to request analysis.
onBeforeUnmount(() => {
  analysisStore.formDrafts[draftKey] = copyFormDraft(form);
});
</script>

<style scoped>
/* The viewport less the app bar, step bar and page title, so the panels fit
   a laptop screen. A minimum, so the column can grow to fit the plot. */
.timeseries-flex {
  min-height: calc(100vh - 250px);
}

.subtitle {
  color: rgb(var(--v-theme-muted));
  font-size: 1.5rem;
}

/* Columns sized by the headers, not by the values, and digits of equal
   width: the table no longer grows or scrolls as the options change. */
.stats-table :deep(table) {
  table-layout: fixed;
  width: 100%;
}

.stats-table :deep(td),
.stats-table :deep(th) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 599px) {
  /* Let the table scroll within its wrapper rather than hide numeric values. */
  .stats-table :deep(table) {
    table-layout: auto;
    min-width: 420px;
  }
}
</style>
