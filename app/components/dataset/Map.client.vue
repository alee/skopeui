<template>
  <MapLibre
    :step="step"
    :display-raster="displayRaster"
    @map-ready="emit('mapReady', $event)"
    @step-ready="emit('stepReady', $event)"
    @step-error="emit('stepError', $event)"
  >
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
  </MapLibre>
</template>

<script setup lang="ts">
import MapLibre from "@/components/dataset/MapLibre.client.vue";
defineProps({
  step: { type: Number, default: 2000 },
  displayRaster: { type: Boolean, default: true },
});
const emit = defineEmits(["mapReady", "stepReady", "stepError"]);
</script>
