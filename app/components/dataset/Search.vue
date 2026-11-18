<template>
  <v-form @submit.prevent>
    <v-row class="mb-n7" align="center" justify="center">
      <!-- filter by variable category -->
      <v-col cols="12" md="3" sm="6">
        <v-combobox
          v-model="filterCriteria.selectedCategories"
          no-filter
          :items="categories"
          label="Filter by variable category"
          multiple
          chips
          closable-chips
          variant="outlined"
        >
          <template #chip="{ item: category, props: chipProps }">
            <v-chip v-bind="chipProps" color="primary" label size="small">
              {{ category }}
            </v-chip>
          </template>
          <template #item="{ item: category, props: itemProps }">
            <v-list-item v-bind="itemProps">
              <template #title>
                <v-chip color="primary" label size="small">
                  {{ category }}
                </v-chip>
              </template>
            </v-list-item>
          </template>
        </v-combobox>
      </v-col>
      <!-- search by keyword -->
      <v-col cols="12" md="5" sm="6">
        <!-- keyword search -->
        <v-text-field
          id="keywordQuery"
          v-model="keywordSearchQuery"
          clearable
          variant="outlined"
          data-toggle="hideseek"
          label="Keyword search"
          append-inner-icon="mdi-magnify"
        />
      </v-col>
      <v-col cols="12" md="2" sm="6">
        <v-text-field
          v-model.number="filterCriteria.yearStart"
          variant="outlined"
          label="Start Year"
          :rules="startYearRules"
          type="number"
        />
      </v-col>
      <v-col cols="12" md="2" sm="6">
        <v-text-field
          v-model.number="filterCriteria.yearEnd"
          variant="outlined"
          :rules="endYearRules"
          label="End Year"
          type="number"
        />
      </v-col>
    </v-row>
  </v-form>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useMetadataStore } from "@/stores/metadata";

const metadataStore = useMetadataStore();
const currentYear = new Date().getFullYear();

const { filterCriteria } = storeToRefs(metadataStore);
const keywordSearchQuery = computed({
  get: () => filterCriteria.value.query,
  set: (query: string | null) => {
    filterCriteria.value.query = query ?? "";
  },
});
const minYear = 1;
const maxYear = currentYear;

const startYearRules = computed(() => [
  (v: number | string) =>
    Number(v) >= minYear || `Please enter a valid start year after ${minYear}`,
  (v: number | string) =>
    Number(v) <= Number(filterCriteria.value.yearEnd) ||
    `Please enter a valid start year before ${filterCriteria.value.yearEnd}`,
]);

const endYearRules = computed(() => [
  (v: number | string) =>
    Number(v) >= Number(filterCriteria.value.yearStart) ||
    `Please enter a valid end year after ${filterCriteria.value.yearStart}`,
  (v: number | string) =>
    Number(v) <= maxYear || `Please enter a valid end year before ${maxYear}`,
]);

const categories = computed(() => {
  const categorySet = new Set<string>();
  for (const dataset of metadataStore.allDatasetMetadata) {
    for (const variable of dataset.variables) {
      if (variable.category != null) categorySet.add(variable.category);
    }
  }
  return Array.from(categorySet);
});
</script>

<style scoped></style>
