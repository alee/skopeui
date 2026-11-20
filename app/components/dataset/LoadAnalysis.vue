<template>
  <!-- Short enough for the navigation drawer; the tooltip names the file. -->
  <v-tooltip
    location="bottom"
    text="Load the skope-request.json from a downloaded analysis (experimental)"
  >
    <template #activator="{ props }">
      <v-btn
        v-bind="props"
        color="primary"
        variant="flat"
        prepend-icon="mdi-upload"
        @click="selectLoadRequestDataFile"
      >
        <input
          ref="requestFile"
          type="file"
          accept=".json"
          style="display: none"
          @click.stop
          @change="handleLoadRequestDataFile"
        >
        Load saved analysis
      </v-btn>
    </template>
  </v-tooltip>
</template>
<script setup lang="ts">
import { useTemplateRef } from "vue";
import { SavedAnalysisValidationError } from "@/utils/savedAnalysis";
import { useSavedAnalysis } from "@/composables/useSavedAnalysis";

const router = useRouter();
const requestFile = useTemplateRef<HTMLInputElement>("requestFile");
const savedAnalysis = useSavedAnalysis();

function selectLoadRequestDataFile() {
  requestFile.value?.click();
}

async function handleLoadRequestDataFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  // Allow choosing the same file again after a failed import.
  input.value = "";
  try {
    const requestData = await savedAnalysis.restore(
      JSON.parse(await file.text()),
    );
    await router.push({
      name: "dataset-id-analyze-variable",
      params: {
        id: requestData.dataset_id,
        variable: requestData.variable_id,
      },
    });
  } catch (error) {
    console.error(error);
    alert(
      error instanceof SavedAnalysisValidationError
        ? error.message
        : "Unable to import the request file.",
    );
  }
}
</script>
