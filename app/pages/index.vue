<template>
  <v-container fluid>
    <v-row>
      <v-col class="ma-0">
        <h1 class="text-h5 d-flex align-center ga-2">
          Select a Dataset
          <v-btn
            icon
            size="small"
            variant="text"
            href="https://www.openskope.org/skope-users-guide/"
            aria-label="SKOPE user guide (opens in a new tab)"
            target="_blank"
          >
            <v-icon size="20">mdi-help-circle-outline</v-icon>
            <v-tooltip
              activator="parent"
              location="bottom"
              text="View the SKOPE user guide (opens in a new tab)"
            />
          </v-btn>
        </h1>
      </v-col>
    </v-row>
    <Search />
    <v-row class="ma-0 pa-0">
      <v-col class="ma-0">
        <template v-for="dataset in datasets" :key="dataset.id">
          <v-card class="pa-4 my-3" elevation="0" variant="outlined">
            <ListItem :dataset="dataset" />
          </v-card>
        </template>
        <LoadingSpinner v-if="loading" />
        <v-alert v-else-if="loadFailed" type="error">
          Unable to load the datasets. Please try again shortly.
        </v-alert>
        <v-alert v-else-if="datasets.length === 0" type="warning">
          No datasets found, please refine your filter criteria.
        </v-alert>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import ListItem from "@/components/dataset/ListItem.vue";
import LoadingSpinner from "@/components/LoadingSpinner.vue";
import Search from "@/components/dataset/Search.vue";
import { useDatasetStore } from "@/stores/dataset";
import { useMetadataStore } from "@/stores/metadata";
import { useDatasetMetadata } from "@/composables/useDatasetMetadata";

definePageMeta({ layout: "default" });

const metadataActions = useDatasetMetadata();
const datasetStore = useDatasetStore();
const metadataStore = useMetadataStore();

const datasets = computed(() => metadataStore.filteredDatasets);
const loadFailed = ref(false);
// No "no datasets found" before the list has had a chance to arrive.
const loading = ref(true);

datasetStore.clearTimeSeries();
datasetStore.setMetadata(null);

await useAsyncData(
  "landingPageMetadata",
  async () => {
    try {
      await metadataActions.loadAllDatasetMetadata();
      loadFailed.value = false;
      return true;
    } catch (error) {
      console.error("Failed to load dataset metadata", error);
      loadFailed.value = true;
      return false;
    } finally {
      loading.value = false;
    }
  },
  { server: false },
);
</script>
