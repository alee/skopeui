<template>
  <v-container fluid class="fill-height">
    <DatasetLoadState
      v-if="metadataState !== 'ready'"
      :state="metadataState"
      @retry="loadMetadata"
    />
    <template v-else>
      <SubHeader>
        <v-btn
          :disabled="!hasValidStudyArea"
          :to="visualizeLocation"
          color="accent"
          variant="flat"
        >
          {{ returnToAnalysis ? "Return to analysis" : "Visualize Data" }}
          <v-icon size="small" class="ml-2"> mdi-chevron-right </v-icon>
        </v-btn>
      </SubHeader>
      <v-row>
        <v-col cols="12" class="d-flex map-flex">
          <Map
            :display-raster="true"
            :step="datasetStore.minYear"
            class="mx-auto"
            @map-ready="mapLoaded"
          />
        </v-col>
        <client-only>
          <v-dialog
            v-model="confirmGeometry"
            transition="dialog-bottom-transition"
            max-width="600"
          >
            <v-card class="pa-6">
              <v-card-text>
                <h3>
                  Welcome back! Would you like to clear the currently selected
                  area?
                </h3>
              </v-card-text>
              <v-card-actions class="study-area-actions justify-space-between">
                <v-btn variant="outlined" color="accent" @click="clearGeometry">
                  Clear selected area
                </v-btn>
                <v-btn variant="flat" color="accent" @click="keepGeometry">
                  Keep selected area
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
        </client-only>
      </v-row>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import DatasetLoadState from "@/components/dataset/DatasetLoadState.vue";
import SubHeader from "@/components/dataset/SubHeader.vue";
import Map from "@/components/dataset/Map.client.vue";
import { useDatasetPage } from "@/composables/useDatasetPage";
import { useStudyArea } from "@/composables/useStudyArea";
import { useAppStore } from "@/stores/app";
import { useDatasetStore } from "@/stores/dataset";

definePageMeta({
  layout: "default",
  validate: ({ params }) =>
    typeof params.id === "string" && /^\w+$/.test(params.id),
});

const route = useRoute();
const postedStudyArea = useState<unknown | null>(
  `posted-study-area:${route.params.id}`,
  () => useRequestEvent()?.context.postedStudyArea ?? null,
);
const importedStudyArea = ref(false);
const { state: metadataState, load: loadMetadata } = useDatasetPage(
  String(route.params.id),
);
const studyArea = useStudyArea();
const appStore = useAppStore();
const datasetStore = useDatasetStore();

const shouldConfirmGeometry = ref(false);

const metadata = computed(() => datasetStore.metadata);
const hasValidStudyArea = computed(() => datasetStore.hasGeoJson);
const isFirstVisit = computed(() => appStore.isFirstVisit);
const confirmGeometry = computed({
  get: () =>
    hasValidStudyArea.value &&
    shouldConfirmGeometry.value &&
    isFirstVisit.value,
  set: (value: boolean) => {
    shouldConfirmGeometry.value = value;
  },
});
const returnToAnalysis = computed(() => route.query?.returnTo === "analyze");

// No link without both params: the router throws mid-render otherwise.
const visualizeLocation = computed(() => {
  const id = route.params.id;
  const variable = datasetStore.variable.id;
  if (!id || !variable) return undefined;
  return {
    name: returnToAnalysis.value
      ? "dataset-id-analyze-variable"
      : "dataset-id-visualize-variable",
    params: { id, variable },
  };
});

await useAsyncData(`dataset-${route.params.id}`, loadMetadata, {
  server: false,
});

onMounted(() => {
  watch(
    metadataState,
    (state) => {
      if (state === "ready" && postedStudyArea.value) {
        studyArea.save(postedStudyArea.value);
        postedStudyArea.value = null;
        importedStudyArea.value = true;
      }
    },
    { immediate: true },
  );
});

useHead(() => ({
  title: metadata.value?.title || "SKOPE",
  meta: metadata.value?.description
    ? [{ name: "description", content: metadata.value.description }]
    : [],
}));

function clearGeometry() {
  shouldConfirmGeometry.value = false;
  appStore.setVisited();
  studyArea.clear();
}

function mapLoaded(_value: boolean) {
  shouldConfirmGeometry.value =
    hasValidStudyArea.value && !importedStudyArea.value;
}

function keepGeometry() {
  shouldConfirmGeometry.value = false;
  appStore.setVisited();
}
</script>
<style scoped>
/* The viewport less the app bar, step bar and page title, so the panels fit
   a laptop screen. */
.map-flex {
  height: calc(100vh - 250px);
}

@media all and (max-width: 960px) {
  .map-flex {
    height: 400px;
  }
}

@media all and (max-width: 600px) {
  .map-flex {
    height: auto;
  }

  .study-area-actions {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .study-area-actions > .v-btn {
    min-height: 44px;
  }
}
</style>
