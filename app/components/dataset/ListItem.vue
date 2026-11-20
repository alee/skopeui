<template>
  <v-row align-content-start justify-space-around>
    <v-col cols="12" md="4" class="list-item-map-col">
      <client-only>
        <div class="list-item-map">
          <DatasetMapPreview
            :title="dataset.title"
            :bbox="dataset.bbox"
            :map-view="dataset.map_view"
            class="list-item-map-canvas"
          />
          <NuxtLink
            :to="absoluteUrl"
            class="list-item-map-link"
            :aria-label="`Select ${dataset.title}`"
          />
        </div>
      </client-only>
    </v-col>
    <v-col cols="12" md="8" class="list-item-info-col d-flex">
      <v-card elevation="0" class="list-item-info">
        <v-card-title class="ma-0 pa-0">
          <h2 class="text-h6 list-item-heading">
            <NuxtLink :to="absoluteUrl" class="dataset-title">
              {{ dataset.title }}
            </NuxtLink>
            <MetadataModal :metadata-id="dataset.id" />
          </h2>
          <div class="list-item-coverage">
            {{ spatialCoverage }} | {{ temporalCoverage }}
          </div>
        </v-card-title>
        <v-card-text class="list-item-description mt-3 pa-0">
          <!-- eslint-disable-next-line vue/no-v-html -- renderMarkdown sanitizes the HTML before this insertion. -->
          <div v-html="sanitizedDescription" />
        </v-card-text>
        <VariableList :variables="safeVariables" />
        <v-card-text v-if="sourceLink" class="list-item-source">
          <b class="text-subtitle-1">Source:</b>{{ " " }}
          <a target="_blank" :href="sourceLink.href">
            {{ sourceLink.title ?? sourceLink.href }}
          </a>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { computed } from "vue";
import DatasetMapPreview from "@/components/dataset/DatasetMapPreview.client.vue";
import MetadataModal from "@/components/dataset/MetadataModal.vue";
import VariableList from "@/components/dataset/VariableList.vue";
import type { Dataset } from "@/types/metadata";
import { renderMarkdown } from "@/utils/markdown";
import { timeCoverageLabel } from "@/utils/timeAxis";

const props = defineProps<{ dataset: Dataset }>();
const sanitizedDescription = computed(() =>
  renderMarkdown(props.dataset.description ?? ""),
);
const safeVariables = computed(() => props.dataset.variables ?? []);

const spatialCoverage = computed(
  () => `${props.dataset.region_name} at ${props.dataset.resolution_label}`,
);
const temporalCoverage = computed(() => timeCoverageLabel(props.dataset.time));
// STAC's "via" link points at the source the dataset was taken from.
const sourceLink = computed(() =>
  props.dataset.links.find((link) => link.rel === "via"),
);
const absoluteUrl = computed(() => `/dataset/${props.dataset.id}`);
</script>
<style scoped>
.list-item-heading {
  margin: 0;
  font: inherit;
}

/* An underline that becomes a highlight on hover, in the theme's accent. */
.dataset-title {
  padding: 0 6px;
  margin: 0 -6px;
  text-decoration: none;
  box-shadow: inset 0 -2px 0 rgb(var(--v-theme-accent));
  transition: box-shadow 0.3s;
  color: inherit;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}

.dataset-title:hover {
  box-shadow: inset 0 -1.6em 0 rgb(var(--v-theme-accent));
  color: white;
}

.list-item-coverage {
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.5;
  color: rgb(var(--v-theme-muted));
}

/* A little wider than Vuetify's 4 of 12 columns for the map. */
@media (min-width: 960px) {
  .list-item-map-col {
    flex: 0 0 38%;
    max-width: 38%;
  }

  .list-item-info-col {
    flex: 1 1 0;
    min-width: 0;
    max-width: none;
  }
}

/* The source line sits at the bottom of the row, however long the rest is. */
/* Visible overflow, so the title's highlight isn't cut off on the left. */
.list-item-info,
.list-item-info :deep(.v-card-title) {
  overflow: visible;
}

.list-item-info {
  display: flex;
  flex-direction: column;
  align-self: stretch;
  width: 100%;
  min-width: 0;
}

.list-item-info :deep(.v-card-title) {
  white-space: normal;
  overflow-wrap: anywhere;
}

.list-item-description {
  flex: 0 0 auto;
}

.list-item-source {
  flex: 0 0 auto;
  margin-top: auto;
  padding: 8px 0 0;
}

.list-item-source a {
  color: rgb(var(--v-theme-primary));
}

/* Fills the column beside the text. The minimum keeps a dataset with few
   variable categories about as tall as the others, and gives the map a height
   when it's stacked above the text. */
.list-item-map {
  position: relative;
  z-index: 1;
  min-height: 300px;
  cursor: pointer;
}

.list-item-map-canvas {
  position: absolute;
  inset: 0;
}
/* MapLibre's attribution controls sit above this link at z-index 2. */
.list-item-map-link {
  position: absolute;
  inset: 0;
  z-index: 1;
}
.list-item-map-link:focus-visible {
  outline: 3px solid rgb(var(--v-theme-primary));
  outline-offset: -3px;
}
</style>
