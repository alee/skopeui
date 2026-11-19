<template>
  <client-only>
    <v-dialog v-model="showCitation" width="auto">
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
        <v-card-title><h2>How to Cite SKOPE</h2></v-card-title>
        <v-card-text>
          <h2>Citation</h2>
          <p class="text-body-1 px-2">
            Use of data, graphics, or other information provided by SKOPE should
            be accompanied by a citation of the original data source provided by
            SKOPE in the dataset metadata and of the SKOPE web application
            itself.
          </p>

          <h2>Example Citation (click text to copy)</h2>
          <v-textarea
            v-model="citationText"
            class="blockquote"
            readonly
            no-resize
            @click="copyToClipboard"
          />
          <h2>BibTeX (click text to copy)</h2>
          <v-textarea
            v-model="citationBibTex"
            class="blockquote"
            readonly
            no-resize
            @click="copyToClipboard"
          />

          <h2>Contact us</h2>
          <p class="text-body-1 px-2">
            Feedback is welcome! You can reach us via the "Contact" button in
            the footer or by sending an email to
            <a href="mailto: skope-team@googlegroups.com">
              skope-team@googlegroups.com
            </a>
          </p>
          <v-snackbar v-model="clipboardMessage" timeout="6000">
            <p class="text-center">
              Citation text copied to clipboard. Use <kbd>Ctrl + V</kbd> to
              paste.
            </p>
          </v-snackbar>
        </v-card-text>
      </v-card>
    </v-dialog>
  </client-only>
</template>
<script setup lang="ts">
import { ref } from "vue";
import citationText from "@/generated/citation.txt?raw";
import citationBibTex from "@/generated/citation.bib?raw";

const showCitation = ref(false);
const clipboardMessage = ref(false);

function copyToClipboard(evt: MouseEvent) {
  const srcElement = evt.target as HTMLTextAreaElement;
  navigator.clipboard.writeText(srcElement.value).then(() => {
    srcElement.select();
    clipboardMessage.value = true;
  });
}
</script>
