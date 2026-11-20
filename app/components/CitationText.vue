<template>
  <div class="mb-4">
    <v-textarea
      :model-value="text"
      :label="label"
      class="blockquote"
      readonly
      no-resize
      hide-details
    />
    <v-btn
      class="mt-2"
      variant="outlined"
      size="small"
      prepend-icon="mdi-content-copy"
      :aria-label="`Copy ${label}`"
      :loading="isCopying"
      @click="copy"
    >
      Copy
    </v-btn>
    <p role="status" class="text-body-2 mt-2">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{ text: string; label: string }>();
const message = ref("");
const isCopying = ref(false);

async function copy() {
  if (isCopying.value) return;
  isCopying.value = true;
  message.value = "";
  try {
    await navigator.clipboard.writeText(props.text);
    message.value = `${props.label} copied to clipboard.`;
  } catch {
    message.value =
      "Could not copy automatically. Select the text above and copy it.";
  } finally {
    isCopying.value = false;
  }
}
</script>
