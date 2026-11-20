<template>
  <client-only>
    <v-dialog
      v-model="showCitation"
      scrollable
      :aria-labelledby="titleId"
      max-width="800"
    >
      <template #activator="{ props }">
        <v-btn
          style="font-weight: bold"
          color="white"
          class="text-body-1"
          variant="plain"
          v-bind="props"
        >
          Cite SKOPE
        </v-btn>
      </template>
      <v-card>
        <v-card-title class="d-flex align-center ga-2">
          <h2 :id="titleId" class="text-wrap">How to Cite SKOPE</h2>
          <v-spacer />
          <v-btn
            icon="mdi-close"
            class="flex-shrink-0"
            variant="text"
            aria-label="Close citation"
            @click="showCitation = false"
          />
        </v-card-title>
        <v-card-text>
          <h2>Citation</h2>
          <p class="text-body-1 px-2">
            Use of data, graphics, or other information provided by SKOPE should
            be accompanied by a citation of the original data source provided by
            SKOPE in the dataset metadata and of the SKOPE web application
            itself.
          </p>

          <CitationText label="Example citation" :text="citationText" />
          <CitationText label="BibTeX" :text="citationBibTex" />

          <h2>Contact us</h2>
          <p class="text-body-1 px-2">
            Feedback is welcome! Use Contact in the top navigation or send an
            email to
            <a href="mailto:skope-team@googlegroups.com">
              skope-team@googlegroups.com
            </a>
          </p>
        </v-card-text>
      </v-card>
    </v-dialog>
  </client-only>
</template>
<script setup lang="ts">
import { ref, useId } from "vue";
import CitationText from "@/components/CitationText.vue";
import citationText from "@/generated/citation.txt?raw";
import citationBibTex from "@/generated/citation.bib?raw";

const showCitation = ref(false);
const titleId = useId();
</script>
