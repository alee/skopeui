<template>
  <div
    class="raster-playback-controls"
    role="group"
    aria-label="Map animation controls"
  >
    <v-tooltip
      location="top"
      text="Go to the first timestep of the defined temporal range"
    >
      <template #activator="{ props: tooltipProps }">
        <v-btn
          icon
          size="44"
          v-bind="tooltipProps"
          color="accent"
          aria-label="First timestep"
          @click="gotoFirstStep"
        >
          <v-icon>mdi-skip-previous</v-icon>
        </v-btn>
      </template>
    </v-tooltip>
    <v-tooltip location="top" text="Previous timestep">
      <template #activator="{ props: tooltipProps }">
        <v-btn
          icon
          size="44"
          v-bind="tooltipProps"
          color="accent"
          aria-label="Previous timestep"
          @click="previousStep"
        >
          <v-icon>mdi-chevron-left</v-icon>
        </v-btn>
      </template>
    </v-tooltip>
    <v-btn
      icon
      size="44"
      color="accent"
      :disabled="!canPlay"
      :aria-label="isPlaying ? 'Pause playback' : 'Play years'"
      :title="isPlaying ? 'Pause playback' : 'Play years'"
      :aria-pressed="!!isPlaying"
      data-test="playback"
      @click="emit('toggle-playback')"
    >
      <v-progress-circular
        v-if="isStepLoading"
        indeterminate
        size="18"
        width="2"
      />
      <v-icon v-else>{{ isPlaying ? "mdi-pause" : "mdi-play" }}</v-icon>
    </v-btn>
    <v-tooltip location="top" text="Next timestep">
      <template #activator="{ props: tooltipProps }">
        <v-btn
          icon
          size="44"
          v-bind="tooltipProps"
          color="accent"
          aria-label="Next timestep"
          @click="nextStep"
        >
          <v-icon>mdi-chevron-right</v-icon>
        </v-btn>
      </template>
    </v-tooltip>
    <v-tooltip
      location="top"
      text="Go to the last timestep of the defined temporal range"
    >
      <template #activator="{ props: tooltipProps }">
        <v-btn
          icon
          size="44"
          v-bind="tooltipProps"
          color="accent"
          aria-label="Last timestep"
          @click="gotoLastStep"
        >
          <v-icon>mdi-skip-next</v-icon>
        </v-btn>
      </template>
    </v-tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useDatasetStore } from "@/stores/dataset";
import { axisYears, stepAlongAxis } from "@/utils/timeAxis";

const props = defineProps<{
  stepSelected: number;
  isPlaying: boolean;
  canPlay: boolean;
  isStepLoading: boolean;
}>();
const emit = defineEmits<{
  (e: "step-selected", step: number): void;
  (e: "toggle-playback"): void;
}>();
const datasetStore = useDatasetStore();
const axis = computed(() =>
  datasetStore.metadata ? axisYears(datasetStore.metadata.time) : [],
);

function gotoFirstStep() {
  emit("step-selected", datasetStore.temporalRangeMin);
}
function gotoLastStep() {
  emit("step-selected", datasetStore.temporalRangeMax);
}
function stepBy(delta: number) {
  emit(
    "step-selected",
    stepAlongAxis(axis.value, props.stepSelected, delta, [
      datasetStore.temporalRangeMin,
      datasetStore.temporalRangeMax,
    ]),
  );
}
function previousStep() {
  stepBy(-1);
}
function nextStep() {
  stepBy(1);
}
</script>

<style scoped>
.raster-playback-controls {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 16px 16px;
}
</style>
