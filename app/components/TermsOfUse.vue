<template>
  <client-only>
    <v-dialog v-model="showTerms" persistent max-width="600">
      <template #activator="{ props }">
        <v-btn
          style="font-weight: bold"
          color="white"
          class="text-body-1"
          variant="plain"
          v-bind="props"
        >
          Terms of Use
        </v-btn>
      </template>
      <v-card>
        <v-card-title><h2>Terms of Use</h2></v-card-title>
        <v-card-text>
          <p class="text-body-1">
            By using the SKOPE application, you assume any risk associated with
            its use. You are solely responsible for any damage or loss you may
            incur resulting from your reliance on or use of information provided
            by SKOPE.
          </p>

          <h2>Citation</h2>
          <p class="text-body-1">
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
          <p class="text-body-1">
            Feedback is welcome! You can reach us via the "Contact" button in
            the footer or by sending an email to
            <a href="mailto: skope-team@googlegroups.com">
              skope-team@googlegroups.com
            </a>
          </p>
        </v-card-text>
        <v-card-actions class="terms-actions">
          <v-btn
            href="https://www.openskope.org"
            variant="outlined"
            color="accent"
            @click="declineTerms"
          >
            I decline, return to www.openskope.org
          </v-btn>
          <v-spacer />
          <v-btn variant="flat" color="accent" @click.stop="acceptTerms"
            >I accept</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
  </client-only>
</template>
<script setup lang="ts">
import { ref, onMounted } from "vue";
import citationText from "@/generated/citation.txt?raw";
import citationBibTex from "@/generated/citation.bib?raw";
import { usePersistenceStorage } from "@/composables/usePersistenceStorage";

const persistenceStorage = usePersistenceStorage();
const TERMS_KEY = "skope:termsAccepted";

const showTerms = ref(true);
const clipboardMessage = ref(false);

onMounted(() => {
  showTerms.value = !persistenceStorage.get(TERMS_KEY);
});

function acceptTerms() {
  showTerms.value = false;
  persistenceStorage.set(TERMS_KEY, true);
}

function declineTerms() {
  persistenceStorage.remove(TERMS_KEY);
}

function copyToClipboard(evt: MouseEvent) {
  const srcElement = evt.target as HTMLTextAreaElement;
  navigator.clipboard.writeText(srcElement.value).then(() => {
    srcElement.select();
    clipboardMessage.value = true;
  });
}
</script>

<style></style>

<style scoped>
@media (max-width: 599px) {
  .terms-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .terms-actions > .v-btn {
    height: auto;
    min-height: 44px;
    white-space: normal;
  }
}
</style>
