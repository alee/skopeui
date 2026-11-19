<template>
  <LoadingSpinner v-if="state === 'loading'" />
  <v-row v-else>
    <v-col cols="12">
      <v-alert :type="state === 'not-found' ? 'warning' : 'error'" role="alert">
        {{
          state === "not-found"
            ? "This dataset or variable is unavailable. Choose another dataset or try again."
            : "Unable to load this dataset. Check your connection and try again."
        }}
      </v-alert>
      <div class="d-flex flex-wrap ga-2 mt-4">
        <v-btn color="accent" @click="emit('retry')">Retry</v-btn>
        <v-btn :to="{ name: 'index' }" variant="outlined"
          >Back to datasets</v-btn
        >
      </div>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import LoadingSpinner from "@/components/LoadingSpinner.vue";
import type { DatasetPageState } from "@/composables/useDatasetPage";

defineProps<{ state: DatasetPageState }>();
const emit = defineEmits<{ (event: "retry"): void }>();
</script>
