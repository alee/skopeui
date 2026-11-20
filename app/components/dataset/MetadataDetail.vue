<template>
  <v-card-text>
    <section v-if="metadata.uncertainty" class="metadata-section">
      <h3 class="text-h5">Uncertainty</h3>
      <p class="metadata-text">{{ metadata.uncertainty.summary }}</p>
      <a
        v-if="metadata.uncertainty.methodology_href"
        :href="metadata.uncertainty.methodology_href"
        target="_blank"
      >
        How the uncertainty was assessed
      </a>
    </section>
    <section v-if="metadata.lineage" class="metadata-section">
      <h3 class="text-h5">Method Summary</h3>
      <p class="metadata-text">{{ metadata.lineage }}</p>
    </section>
    <section v-if="originators.length > 0" class="metadata-section">
      <h3 class="text-h5">Originator</h3>
      <p>{{ originators.join("; ") }}</p>
    </section>
    <section v-if="hasReferences" class="metadata-section">
      <h3 class="text-h5">References</h3>
      <p v-if="metadata.citation">
        {{ metadata.citation }}
        <a v-if="metadata.doi" :href="doiUrl(metadata.doi)" target="_blank">
          doi:{{ metadata.doi }}
        </a>
      </p>
      <p
        v-for="publication in metadata.publications"
        :key="publication.citation"
      >
        {{ publication.citation }}
        <a
          v-if="publication.doi"
          :href="doiUrl(publication.doi)"
          target="_blank"
        >
          doi:{{ publication.doi }}
        </a>
      </p>
    </section>
    <section class="metadata-section">
      <h3 class="text-h5">License</h3>
      <p>
        <a
          v-if="licenseHref"
          :href="licenseHref"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="`${licenseLabel} (opens in a new tab)`"
        >
          {{ licenseLabel }}
        </a>
        <template v-else>{{ licenseLabel }}</template>
      </p>
    </section>
    <section v-if="otherLinks.length > 0" class="metadata-section">
      <h3 class="text-h5">Links</h3>
      <p v-for="link in otherLinks" :key="link.href">
        <a :href="link.href" target="_blank">{{ link.title ?? link.href }}</a>
      </p>
    </section>
    <VariableList :variables="metadata.variables" />
  </v-card-text>
</template>

<script setup lang="ts">
import { computed } from "vue";
import VariableList from "@/components/dataset/VariableList.vue";
import { licenseLink } from "@/utils/licenseLink";
import type { Dataset } from "@/types/metadata";

const props = defineProps<{ metadata: Dataset }>();
const licenseHref = computed(() => licenseLink(props.metadata));
const licenseLabel = computed(() => {
  if (props.metadata.license !== "other") return props.metadata.license;
  return licenseHref.value
    ? "See provider’s reuse terms"
    : "Provider reuse terms (link unavailable)";
});
const otherLinks = computed(() =>
  props.metadata.links.filter((link) => link.rel !== "license"),
);

const originators = computed(() =>
  props.metadata.providers
    .filter((provider) => provider.roles.includes("producer"))
    .map((provider) => provider.name),
);
const hasReferences = computed(
  () =>
    props.metadata.citation != null || props.metadata.publications.length > 0,
);

function doiUrl(doi: string) {
  return `https://doi.org/${doi}`;
}
</script>

<style scoped>
.metadata-section {
  padding: 8px 0;
}

.metadata-text {
  white-space: pre-line;
}
</style>
