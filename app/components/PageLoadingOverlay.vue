<template>
  <!-- Covers the page being left while the next one loads. Only after a
       delay, so quick page changes don't flash it. -->
  <v-overlay
    :model-value="isVisible"
    contained
    persistent
    scrim="white"
    :opacity="0.7"
    class="align-center justify-center"
    data-test="page-loading"
  >
    <v-progress-circular
      aria-label="Loading page"
      indeterminate
      color="primary"
      size="48"
      width="4"
    />
  </v-overlay>
</template>

<script setup lang="ts">
import { onUnmounted, ref } from "vue";

const SHOW_AFTER_MS = 500;

const isVisible = ref(false);
let showTimer: ReturnType<typeof setTimeout> | null = null;

function clearShowTimer() {
  if (showTimer) clearTimeout(showTimer);
  showTimer = null;
}

const nuxtApp = useNuxtApp();
const removeHooks = [
  nuxtApp.hook("page:loading:start", () => {
    clearShowTimer();
    showTimer = setTimeout(() => {
      isVisible.value = true;
    }, SHOW_AFTER_MS);
  }),
  nuxtApp.hook("page:loading:end", () => {
    clearShowTimer();
    isVisible.value = false;
  }),
];

onUnmounted(() => {
  clearShowTimer();
  removeHooks.forEach((remove) => remove());
});
</script>
