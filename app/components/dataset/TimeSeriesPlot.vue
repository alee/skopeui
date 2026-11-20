<template>
  <v-card
    variant="outlined"
    class="time-series-card"
    :class="{ 'time-series-card--compact': compactPlot }"
  >
    <PanelHeader class="time-series-header">
      <AreaReadout v-if="showArea" />
      <v-form
        ref="temporalRangeForm"
        v-model="isTemporalRangeValid"
        class="time-series-range"
        @focusin="emit('pause-playback')"
        @submit.prevent="setTemporalRange"
      >
        <v-text-field
          v-model.number="localTemporalRangeMin"
          class="time-series-range-field"
          label="From"
          density="compact"
          variant="outlined"
          :hide-details="false"
          validate-on="blur"
          :min="minStep"
          :max="maxStep - 1"
          type="number"
          :rules="[validateMinStep]"
          @keydown.enter.prevent="setTemporalRange"
        />
        <v-text-field
          v-model.number="localTemporalRangeMax"
          class="time-series-range-field"
          label="To"
          density="compact"
          variant="outlined"
          :hide-details="false"
          validate-on="blur"
          :min="minStep + 1"
          :max="maxStep"
          :rules="[validateMaxStep]"
          type="number"
          @keydown.enter.prevent="setTemporalRange"
        />
        <v-btn
          :disabled="!hasTemporalRangeChanges || !isTemporalRangeValid"
          size="small"
          color="secondary"
          @click="setTemporalRange"
        >
          Apply
        </v-btn>
        <v-btn size="small" color="secondary" @click="resetTemporalRange">
          Reset
        </v-btn>
        <span class="time-series-range-steps">{{ timeStepsLabel }}</span>
      </v-form>
      <v-text-field
        v-if="showStepControls"
        v-model="stepDraft"
        class="time-series-current-year"
        :style="{ '--current-year-accent': PLOT_COLORS.plotAccent }"
        :label="temporalLabels.current"
        density="compact"
        variant="outlined"
        base-color="primary"
        color="primary"
        :hint="isStepLoading ? 'Loading map…' : 'Shown on map'"
        persistent-hint
        :hide-details="false"
        :error="isStepDraftInvalid"
        :error-messages="
          isStepMessageVisible
            ? [`Use ${temporalRangeMin}–${temporalRangeMax}.`]
            : []
        "
        type="text"
        inputmode="numeric"
        title="Displayed year: type a year and press Enter"
        :aria-label="temporalLabels.current"
        :aria-invalid="isStepDraftInvalid"
        data-test="current-step"
        @focus="focusStepDraft"
        @input="hideStepMessage"
        @keydown.enter.prevent="applyStepDraft"
        @keydown.esc.prevent="resetStepDraft"
        @blur="applyStepDraftOnBlur"
      >
        <template #prepend-inner>
          <v-icon :color="PLOT_COLORS.plotAccent" size="12" aria-hidden="true">
            mdi-circle
          </v-icon>
        </template>
        <template #message="{ message }">
          <span :data-test="isStepMessageVisible ? 'step-message' : undefined">
            {{ message }}
          </span>
        </template>
      </v-text-field>
    </PanelHeader>

    <div ref="plotShell" class="time-series-plot-shell">
      <div
        v-if="timeSeriesRequestStatus.status === 'loading'"
        class="timeseries-loading-overlay"
      >
        <v-progress-circular
          aria-label="Loading time series"
          indeterminate
          color="primary"
          size="52"
          width="4"
        />
        <p role="status" class="loading-message mt-4">{{ loadingMessage }}</p>
      </div>
      <client-only placeholder="Loading...">
        <template
          v-if="
            timeSeriesRequestStatus.status !== 'success' &&
            timeSeriesRequestStatus.status !== 'loading'
          "
        >
          <v-alert
            v-for="(message, index) in timeSeriesRequestStatus.messages.filter(
              (m) => m.type !== 'error',
            )"
            :key="index"
            :type="message.type"
            class="mb-2"
          >
            {{ message.value }}
          </v-alert>
        </template>
        <Plotly
          class="time-series"
          :data="timeSeriesData"
          :layout="layoutMetadata"
          :options="options"
          :shapes="shapes"
          @api-ready="setPlotImageApi"
          @click="updatePlotlyStep"
          @ready="emit('plot-ready', $event)"
        />
      </client-only>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onMounted,
  onUnmounted,
  onBeforeUnmount,
  nextTick,
  defineAsyncComponent,
} from "vue";
import type { VForm } from "vuetify/components";
import { useElementSize } from "@vueuse/core";
import type { PlotImageApi, ExportTrace } from "@/types/plot";
import type { Annotation, Layout, Config, Shape } from "plotly.js";
import AreaReadout from "@/components/dataset/AreaReadout.vue";
import PanelHeader from "@/components/dataset/PanelHeader.vue";
import { useDatasetStore } from "@/stores/dataset";
import { wrapPlotTitle, wrapPlotLabel } from "@/utils/plotTitle";
import { PLOT_COLORS } from "@/utils/colors";
import {
  axisYears,
  resolveTemporalLabels,
  stepFromText,
} from "@/utils/timeAxis";

const props = defineProps<{
  stepSelected?: number | null;
  showStepControls?: boolean;
  isStepLoading?: boolean;
  /** Show the API's area and cell count (analyze; visualize shows it on the map). */
  showArea?: boolean;
  traces?: any[];
  yAxisLabel?: string | null;
}>();

const emit = defineEmits<{
  (e: "step-selected", step: number): void;
  (e: "selected-temporal-range", range: [number, number]): void;
  (e: "pause-playback"): void;
  (e: "plot-ready", ready: boolean): void;
}>();

// Lazy-load PlotlyClient to avoid SSR issues
const Plotly = defineAsyncComponent(
  () => import("@/components/dataset/PlotlyClient.vue"),
);

const datasetStore = useDatasetStore();
const plotShell = ref<HTMLElement | null>(null);
const { width: plotWidth } = useElementSize(plotShell);
const compactPlot = computed(
  () => plotWidth.value > 0 && plotWidth.value < 480,
);

// Local state
const localTemporalRangeMin = ref(1);
const localTemporalRangeMax = ref(new Date().getFullYear());
const isTemporalRangeValid = ref(false);
const temporalRangeForm = ref<InstanceType<typeof VForm> | null>(null);
let plotImageApi: PlotImageApi | null = null;
function setPlotImageApi(api: PlotImageApi | null) {
  plotImageApi = api;
}

const PROGRESSIVE_MESSAGES = [
  { delay: 8_000, text: "Still working..." },
  { delay: 16_000, text: "Hang tight, almost there..." },
  {
    delay: 24_000,
    text: "This is taking longer than usual, but we'll get there...",
  },
];

const loadingMessage = ref("");
let progressiveTimers: ReturnType<typeof setTimeout>[] = [];

function startProgressiveMessages() {
  clearProgressiveMessages();
  progressiveTimers = PROGRESSIVE_MESSAGES.map(({ delay, text }) =>
    setTimeout(() => {
      loadingMessage.value = text;
    }, delay),
  );
}

function clearProgressiveMessages() {
  progressiveTimers.forEach(clearTimeout);
  progressiveTimers = [];
  loadingMessage.value = "";
}

// Computed
const selectedTemporalRange = computed({
  get() {
    return datasetStore.temporalRange;
  },
  set(range: [number, number]) {
    datasetStore.setTemporalRange(range);
    emit("selected-temporal-range", datasetStore.temporalRange);
  },
});

const temporalRangeMin = computed(() => datasetStore.temporalRangeMin);
const temporalRangeMax = computed(() => datasetStore.temporalRangeMax);
const timeSeriesRequestStatus = computed(
  () => datasetStore.timeSeriesRequestStatus,
);
const axis = computed(() =>
  datasetStore.metadata ? axisYears(datasetStore.metadata.time) : [],
);
const minStep = computed(() => datasetStore.minYear);
const maxStep = computed(() => datasetStore.maxYear);
const variable = computed(() => datasetStore.variable);
const timeSeriesData = computed(() => props.traces ?? []);
const hasMultipleTimeSeries = computed(
  () => props.traces != null && props.traces.length > 1,
);
const canHandleTimeSeriesRequest = computed(
  () => datasetStore.canHandleTimeSeriesRequest,
);

const hasTemporalRangeChanges = computed(
  () =>
    localTemporalRangeMin.value !== selectedTemporalRange.value[0] ||
    localTemporalRangeMax.value !== selectedTemporalRange.value[1],
);

const timeStepsLabel = computed(() => {
  const steps =
    selectedTemporalRange.value[1] - selectedTemporalRange.value[0] + 1;
  return `${steps} time steps`;
});

const yAxisTitle = computed(() => {
  if (props.yAxisLabel) return props.yAxisLabel;
  const { title, unit } = variable.value;
  return unit ? `${title} (${unit})` : title;
});

// Metadata 1.0.0 has no presentation labels: use the shared defaults. A future
// contract can provide overrides here without changing the plot or field.
const temporalLabels = computed(() =>
  resolveTemporalLabels(datasetStore.metadata?.time),
);

const shapes = computed<Shape[]>(() => {
  const step = props.stepSelected;
  // A new range can arrive before its first raster. The old map year's
  // marker must not stretch the new timeline while that frame loads.
  if (
    step != null &&
    step >= temporalRangeMin.value &&
    step <= temporalRangeMax.value
  ) {
    return [
      {
        type: "line",
        x0: step,
        x1: step,
        yref: "paper",
        y0: 0,
        y1: 1,
        line: { color: PLOT_COLORS.plotAccent, width: 3 },
      },
    ];
  }
  return [];
});

// The left margin is a fixed budget for the y tick labels and a title of up
// to two lines, so the plot doesn't move when the variable or transform
// changes. Tick labels wider than 5 characters (-1000) would run into the
// title.
const Y_TICK_LABELS_WIDTH = 58;
const AXIS_TITLE_SIZE = 14;
const Y_TITLE_LINE_HEIGHT = 20;
const MARGIN_LEFT = Y_TICK_LABELS_WIDTH + 2 * Y_TITLE_LINE_HEIGHT + 4;
const MARGIN_RIGHT = 80;
const COMPACT_TOOLBAR_HEIGHT = 104;
// The longest title kept on one line. It fits the plot's minimum height
// (.time-series), and longer titles wrap in two halves that do too.
const Y_TITLE_MAX_LINE_LENGTH = 44;

// An annotation, not the axis title: Plotly places an axis title from its tick
// labels, so it would move with their width. A one-line title sits on the
// line next to the axis.
const yAxisTitleAnnotation = computed<Partial<Annotation>>(() => ({
  text: wrapPlotTitle(yAxisTitle.value ?? "", Y_TITLE_MAX_LINE_LENGTH),
  font: { size: AXIS_TITLE_SIZE },
  textangle: -90,
  xref: "paper",
  yref: "paper",
  x: 0,
  y: 0.5,
  xanchor: "right",
  yanchor: "middle",
  xshift: -Y_TICK_LABELS_WIDTH,
  showarrow: false,
}));

const compactTitle = computed(() =>
  wrapPlotLabel(
    yAxisTitle.value ?? "",
    Math.max(18, Math.floor(plotWidth.value / 8)),
  ),
);

const layoutMetadata = computed<Partial<Layout>>(() => ({
  autosize: true,
  margin: compactPlot.value
    ? {
        l: 48,
        r: 12,
        b: 52,
        t:
          COMPACT_TOOLBAR_HEIGHT +
          compactTitle.value.split("<br>").length * 20 +
          (hasMultipleTimeSeries.value ? 56 : 24),
        pad: 2,
      }
    : { l: MARGIN_LEFT, r: MARGIN_RIGHT, b: 60, t: 10, pad: 2 },
  title: compactPlot.value
    ? {
        text: compactTitle.value,
        font: { size: AXIS_TITLE_SIZE },
        x: 0.5,
        xanchor: "center",
        y: 0.98,
        yanchor: "top",
        pad: { t: COMPACT_TOOLBAR_HEIGHT },
        automargin: true,
      }
    : undefined,
  showlegend: hasMultipleTimeSeries.value,
  legend: compactPlot.value
    ? { orientation: "h", x: 0, y: 1.02, xanchor: "left", yanchor: "bottom" }
    : { x: 1, y: 0.5 },
  xaxis: {
    title: { text: temporalLabels.value.axis, font: { size: AXIS_TITLE_SIZE } },
    range: [temporalRangeMin.value, temporalRangeMax.value],
    autorange: false,
    // Preserve user zoom during playback, but reset it for a new selection.
    uirevision: `${datasetStore.metadata?.id}:${variable.value.id}:${temporalRangeMin.value}:${temporalRangeMax.value}`,
    linewidth: 3,
    gridwidth: 3,
    automargin: true,
    ...(compactPlot.value ? { nticks: 4, tickangle: 0 } : {}),
  },
  yaxis: {
    linewidth: 3,
    gridwidth: 3,
    automargin: compactPlot.value,
  },
  font: { size: 14 },
  // In trace order: the first series, then Smoothed.
  colorway: [PLOT_COLORS.main, PLOT_COLORS.plotAccent],
  annotations: compactPlot.value ? [] : [yAxisTitleAnnotation.value],
}));

const options = computed<Partial<Config>>(() => ({
  displaylogo: false,
  displayModeBar: compactPlot.value ? true : "hover",
  modeBarButtonsToRemove: ["toImage"],
}));

// Methods
function validateMinStep(value: number) {
  if (!Number.isInteger(value)) return "Enter a whole year.";
  if (value < minStep.value) return `Use ${minStep.value} or later.`;
  if (value >= maxStep.value) return `Use a year before ${maxStep.value}.`;
  if (value > localTemporalRangeMax.value)
    return "From must be no later than To.";
  return true;
}

function validateMaxStep(value: number) {
  if (!Number.isInteger(value)) return "Enter a whole year.";
  if (value <= minStep.value) return `Use a year after ${minStep.value}.`;
  if (value > maxStep.value) return `Use ${maxStep.value} or earlier.`;
  if (value < localTemporalRangeMin.value)
    return "To must be no earlier than From.";
  return true;
}

function updatePlotlyStep(data: any) {
  setStep(data.points[0].x);
}

function setStep(step: number) {
  emit("pause-playback");
  emit("step-selected", step);
}

async function setTemporalRange() {
  // Enter can submit before blur validation runs. Always validate the draft
  // before changing the selected range or requesting new data. Reset changes
  // both fields at once, so let their values update before validation.
  await nextTick();
  const result = await temporalRangeForm.value?.validate();
  if (!result?.valid || !hasTemporalRangeChanges.value) return;
  selectedTemporalRange.value = [
    localTemporalRangeMin.value,
    localTemporalRangeMax.value,
  ];
  if (props.stepSelected == null) return;
  if (props.stepSelected < temporalRangeMin.value)
    setStep(temporalRangeMin.value);
  else if (props.stepSelected > temporalRangeMax.value)
    setStep(temporalRangeMax.value);
}

function resetTemporalRange() {
  emit("pause-playback");
  localTemporalRangeMin.value = datasetStore.minYear;
  localTemporalRangeMax.value = datasetStore.maxYear;
  setTemporalRange();
}

// The timestep typed in the header, applied on Enter or when the field loses
// focus. A timestep outside the range on screen is rejected, with
// a message that says which ones are allowed.
const STEP_MESSAGE_LINGER = 4_000;
const stepDraft = ref("");
const isStepDraftInvalid = ref(false);
const isStepMessageVisible = ref(false);
let stepMessageTimer: ReturnType<typeof setTimeout> | null = null;

function focusStepDraft(event: FocusEvent) {
  emit("pause-playback");
  (event.target as HTMLInputElement).select();
}

function currentStepText() {
  return props.stepSelected == null ? "" : String(props.stepSelected);
}

function clearStepMessageTimer() {
  if (stepMessageTimer != null) clearTimeout(stepMessageTimer);
  stepMessageTimer = null;
}

function hideStepMessage() {
  clearStepMessageTimer();
  isStepDraftInvalid.value = false;
  isStepMessageVisible.value = false;
}

function resetStepDraft() {
  hideStepMessage();
  stepDraft.value = currentStepText();
}

/** Selects the timestep the draft names; false if it names none in range. */
function commitStepDraft() {
  const step = stepFromText(axis.value, stepDraft.value, [
    temporalRangeMin.value,
    temporalRangeMax.value,
  ]);
  if (step === null) return false;
  hideStepMessage();
  stepDraft.value = String(step);
  if (step !== props.stepSelected) setStep(step);
  return true;
}

function applyStepDraft() {
  if (commitStepDraft()) return;
  clearStepMessageTimer();
  isStepDraftInvalid.value = true;
  isStepMessageVisible.value = true;
}

// Leaving the field puts the current timestep back, so it never shows one the
// plot isn't on; the message stays a moment to say why.
function applyStepDraftOnBlur() {
  if (stepDraft.value === currentStepText() || commitStepDraft()) return;
  stepDraft.value = currentStepText();
  isStepDraftInvalid.value = false;
  isStepMessageVisible.value = true;
  clearStepMessageTimer();
  stepMessageTimer = setTimeout(hideStepMessage, STEP_MESSAGE_LINGER);
}

watch(() => props.stepSelected, resetStepDraft, { immediate: true });

async function getTimeSeriesPlotImage(expectedTraces?: ExportTrace[]) {
  const plotlyApi = plotImageApi;
  if (!plotlyApi) throw new Error("The plot is not ready for export.");
  return plotlyApi.toImages(expectedTraces);
}

// Watch the status object, not its `status` string: every request sets a new
// object, so a first request (loading -> loading) restarts the messages too.
watch(
  timeSeriesRequestStatus,
  ({ status }) => {
    if (status === "loading") startProgressiveMessages();
    else clearProgressiveMessages();
  },
  { immediate: true },
);

onUnmounted(() => {
  clearProgressiveMessages();
  clearStepMessageTimer();
});

defineExpose({ getTimeSeriesPlotImage });

onMounted(() => {
  const draft = datasetStore.temporalRangeDraft;
  const [min, max] = selectedTemporalRange.value;
  if (draft && draft.range[0] === min && draft.range[1] === max) {
    localTemporalRangeMin.value = draft.min;
    localTemporalRangeMax.value = draft.max;
  } else {
    localTemporalRangeMin.value = min;
    localTemporalRangeMax.value = max;
  }
});

onBeforeUnmount(() => {
  datasetStore.temporalRangeDraft = hasTemporalRangeChanges.value
    ? {
        range: [...selectedTemporalRange.value],
        min: localTemporalRangeMin.value,
        max: localTemporalRangeMax.value,
      }
    : null;
});

watch(
  () =>
    [
      minStep.value,
      maxStep.value,
      selectedTemporalRange.value[0],
      selectedTemporalRange.value[1],
    ] as const,
  ([nextMin, nextMax, selectedMin, selectedMax]) => {
    // Keep the selected range within metadata bounds when datasets/routes change.
    if (
      selectedMin < nextMin ||
      selectedMax > nextMax ||
      selectedMin > selectedMax
    ) {
      selectedTemporalRange.value = [nextMin, nextMax];
    }

    // An externally applied interval supersedes any unsubmitted draft.
    localTemporalRangeMin.value = selectedTemporalRange.value[0];
    localTemporalRangeMax.value = selectedTemporalRange.value[1];
  },
  { immediate: true },
);
</script>
<style>
/* Fills its column, which grows instead when the plot's minimum height and
   the controls don't fit, so neither overlaps the other. */
.time-series-card {
  --plot-min-height: 410px;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
}

/* The always-visible narrow toolbar gets its own band above the value title. */
.time-series-card--compact {
  --plot-min-height: 520px;
}

.time-series-card--compact .js-plotly-plot .plotly .modebar {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  right: 0;
}

.time-series-card--compact .js-plotly-plot .plotly .modebar-group {
  display: contents;
}

.time-series-card--compact .js-plotly-plot .plotly .modebar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
}

.time-series-card--compact .js-plotly-plot .plotly .modebar-btn svg {
  position: static;
}

.time-series-card--compact .js-plotly-plot .plotly .modebar-btn path {
  /* Plotly assigns translucent fills inline; keep persistent tools legible. */
  fill: rgb(var(--v-theme-muted)) !important;
}

.time-series-card--compact .js-plotly-plot .plotly .modebar-btn.active path {
  fill: rgb(var(--v-theme-primary)) !important;
}

.time-series-card .js-plotly-plot .plotly .modebar:focus-within,
.time-series-card .js-plotly-plot .plotly .modebar:focus-within .modebar-group {
  opacity: 1;
}

.time-series-card .js-plotly-plot .plotly .modebar-btn:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

/* Align controls at their inputs; the fields reserve validation space below. */
.time-series-card > .panel-header.time-series-header {
  align-items: flex-start;
}

.time-series-range {
  flex: 1 1 420px;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
}

.time-series-range > .v-btn {
  margin-top: 6px;
}

/* A fixed width, so the range's row is sized from its contents and doesn't
   wrap while there's room. */
.time-series-range-field {
  flex: 0 0 120px;
  width: 120px;
}

/* Always reserve two lines for validation, including while the field is
   valid. Short messages fit here without moving the toolbar or plot. */
.time-series-range-field .v-input__details,
.time-series-current-year .v-input__details {
  min-height: 36px;
}

.time-series-range-steps {
  margin-top: 10px;
  font-size: 0.875rem;
  color: rgb(var(--v-theme-muted));
  white-space: nowrap;
}

/* Sized from the plot's minimum, not its rendered height, so the card can
   shrink again when the window does. */
.time-series-plot-shell {
  position: relative;
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  min-height: calc(var(--plot-min-height) + 32px);
  padding: 16px;
}

.time-series-current-year {
  flex: 0 0 120px;
  width: 120px;
  margin-left: auto;
  align-self: flex-start;
}

/* A distinct current-frame readout, tied to the plot cursor by its marker.
   Label and helper text explain the meaning independently of color. */
.time-series-current-year .v-field {
  background-color: rgb(var(--v-theme-panel));
  background-color: color-mix(
    in srgb,
    var(--current-year-accent) 8%,
    rgb(var(--v-theme-surface))
  );
}

.time-series-current-year input {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.time-series-current-year .v-field-label,
.time-series-current-year .v-field__prepend-inner > .v-icon {
  opacity: 1;
}

.time-series-current-year .v-field__outline {
  --v-field-border-opacity: 0.65;
}

.time-series-current-year:not(.v-input--error) .v-messages {
  color: rgb(var(--v-theme-muted));
  opacity: 1;
}

.timeseries-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.8);
  pointer-events: none;
}

.loading-message {
  font-size: 13px;
  color: rgb(var(--v-theme-muted));
}

/* Tall enough for a one-line y-axis title of Y_TITLE_MAX_LINE_LENGTH. */
.time-series {
  flex: 1 1 0;
  width: 100%;
  min-height: var(--plot-min-height);
}

@media (max-width: 599px) {
  .time-series-range-field {
    flex: 1 1 calc(50% - 4px);
    width: auto;
    min-width: 0;
  }

  .time-series-range > .v-btn {
    min-width: 44px;
    min-height: 44px;
  }
}
</style>
