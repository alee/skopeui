<template>
  <v-dialog v-model="showMetadata" max-width="800px">
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
        <h3 class="font-weight-light text-wrap text-white">
          {{ metadata?.title ?? "Dataset metadata" }}
        </h3>
        <v-spacer />
        <v-btn
          icon
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
import { ref, computed } from "vue";
import MetadataDetail from "@/components/dataset/MetadataDetail.vue";
import { useMetadataStore } from "@/stores/metadata";

const props = defineProps<{ metadataId: string }>();
const showMetadata = ref(false);
const metadataStore = useMetadataStore();
const metadata = computed(() => metadataStore.find(props.metadataId));
</script>
