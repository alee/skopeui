<template>
  <v-tooltip v-if="numberOfCells > 0" location="bottom" :text="TOOLTIP">
    <template #activator="{ props: tooltipProps }">
      <span
        v-bind="tooltipProps"
        tabindex="0"
        class="area-readout"
        data-test="area-readout"
      >
        {{ label }}
      </span>
    </template>
  </v-tooltip>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useDatasetStore } from "@/stores/dataset";

// The API measures the shape after reprojecting it into the dataset's CRS, so
// the readout only appears once a time series has come back.
const TOOLTIP =
  "Area of the selected shape in the dataset's coordinate system, and the number of grid cells used in this time series.";

const datasetStore = useDatasetStore();
const numberOfCells = computed(() => datasetStore.numberOfCells);

const label = computed(() => {
  const cells = `${numberOfCells.value.toLocaleString("en-US")} ${
    numberOfCells.value === 1 ? "cell" : "cells"
  }`;
  const area = datasetStore.areaInSquareKm;
  // A point has no area; its one cell is the useful number.
  if (area === 0) return cells;
  const km2 = area.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${km2} km² · ${cells}`;
});
</script>

<style scoped>
.area-readout {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  max-width: 100%;
  background-color: rgb(var(--v-theme-panel));
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 300;
  padding: 6px 10px;
  font-variant-numeric: tabular-nums;
  white-space: normal;
  overflow-wrap: anywhere;
}

.area-readout:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
</style>
