<template>
  <div
    ref="container"
    class="dataset-map-preview"
    role="region"
    :aria-label="`Map of ${title}`"
  />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { setWorkerUrl } from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Bbox } from "@/composables/useMapInitialViewport";
import type { MapView } from "@/types/metadata";
import { createMapPreview } from "@/utils/maplibre/preview";

const props = defineProps<{
  title: string;
  bbox: Bbox;
  mapView: MapView | null;
}>();
const container = ref<HTMLElement | null>(null);
const preview = createMapPreview(() => ({
  bbox: props.bbox,
  map_view: props.mapView,
}));
let visibility: IntersectionObserver | null = null;
let disposed = false;

onMounted(() => {
  if (!container.value) return;
  setWorkerUrl(mapWorkerUrl);
  // Release offscreen WebGL contexts as well as deferring their creation.
  if (typeof IntersectionObserver === "undefined")
    preview.mount(container.value);
  else {
    visibility = new IntersectionObserver(
      (entries) => {
        if (disposed) return;
        for (const entry of entries) {
          if (entry.isIntersecting && container.value)
            preview.mount(container.value);
          else preview.dispose();
        }
      },
      { rootMargin: "200px 0px" },
    );
    visibility.observe(container.value);
  }
});
onUnmounted(() => {
  disposed = true;
  visibility?.disconnect();
  preview.dispose();
});
watch(
  () => [props.bbox, props.mapView],
  () => preview.update(),
  { deep: true },
);
</script>
