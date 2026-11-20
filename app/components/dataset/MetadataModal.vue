<template>
  <v-dialog
    v-model="showMetadata"
    max-width="800px"
    scrollable
    :aria-labelledby="titleId"
  >
    <template #activator="{ props: dialogProps }">
      <v-tooltip
        location="bottom"
        text="View dataset metadata with important details on uncertainty and provenance"
      >
        <template #activator="{ props: tooltipProps }">
          <v-btn
            icon
            size="x-small"
            rounded
            variant="text"
            class="ml-2"
            aria-label="Dataset details"
            v-bind="{ ...dialogProps, ...tooltipProps }"
          >
            <v-icon color="primary">mdi-information-outline</v-icon>
          </v-btn>
        </template>
      </v-tooltip>
    </template>
    <v-card>
      <v-card-title class="d-flex align-center bg-secondary">
        <h2
          :id="titleId"
          class="metadata-title font-weight-light text-wrap text-white"
        >
          {{ metadata?.title ?? "Dataset metadata" }}
        </h2>
        <v-spacer />
        <v-btn
          icon
          class="flex-shrink-0"
          variant="text"
          aria-label="Close"
          @click="showMetadata = false"
        >
          <v-icon color="white">mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      <MetadataDetail v-if="metadata" :metadata="metadata" />
    </v-card>
  </v-dialog>
</template>
<script setup lang="ts">
import { ref, computed, useId } from "vue";
import MetadataDetail from "@/components/dataset/MetadataDetail.vue";
import { useMetadataStore } from "@/stores/metadata";

const props = defineProps<{ metadataId: string }>();
const showMetadata = ref(false);
const titleId = useId();
const metadataStore = useMetadataStore();
const metadata = computed(() => metadataStore.find(props.metadataId));
</script>

<style scoped>
.metadata-title {
  min-width: 0;
  font-size: inherit;
  overflow-wrap: anywhere;
}
</style>
