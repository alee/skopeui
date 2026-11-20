<template>
  <v-row align="center" justify="space-between" class="sub-header">
    <v-col md="6" sm="9" cols="12" class="d-flex align-center ga-1">
      <h1 class="text-h6 dataset-heading">
        {{ metadata?.title }}
      </h1>
      <MetadataModal v-if="metadata" :metadata-id="metadata.id" />
      <v-btn
        icon
        size="x-small"
        href="https://www.openskope.org/skope-users-guide/"
        aria-label="SKOPE user guide (opens in a new tab)"
        target="_blank"
      >
        <v-icon>mdi-help-circle-outline</v-icon>
        <v-tooltip
          activator="parent"
          location="bottom"
          text="View the SKOPE user guide (opens in a new tab)"
        />
      </v-btn>
    </v-col>
    <v-col v-if="selectVariable" cols="12" sm="6" md="3">
      <v-select
        v-model="variable"
        label="Select a variable"
        item-color="secondary"
        color="secondary"
        density="compact"
        hide-details
        :items="variables"
        item-title="title"
        item-value="id"
        variant="outlined"
      />
    </v-col>
    <v-col cols="12" sm="auto" class="ml-auto sub-header-actions">
      <!-- Keep workflow actions visible and let them wrap on narrow screens. -->
      <slot />
    </v-col>
  </v-row>
</template>
<script setup lang="ts">
import { computed } from "vue";
import MetadataModal from "@/components/dataset/MetadataModal.vue";
import { useDatasetStore } from "@/stores/dataset";

defineProps<{ selectVariable?: boolean }>();
const route = useRoute();
const router = useRouter();
const datasetStore = useDatasetStore();

const metadata = computed(() => datasetStore.metadata);
const variables = computed(() => metadata.value?.variables ?? []);

const variable = computed({
  get() {
    return datasetStore.variable.id;
  },
  set(variableId: string) {
    datasetStore.setVariable(variableId);
    router.push({
      name: route.name as string,
      params: { id: route.params.id as string, variable: variableId },
    });
  },
});
</script>

<style scoped>
.dataset-heading {
  font: inherit;
}

.sub-header-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

/* Same height with or without the variable select (a compact field is 40px),
   so the panels below start at the same place on every page. The top margin
   matches the gap below so the header sits centered between the step bar and
   the panels. */
.sub-header {
  min-height: 40px;
  margin-top: 8px;
}
</style>
