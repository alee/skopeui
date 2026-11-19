<template>
  <v-navigation-drawer v-model="navigationVisible" temporary>
    <v-list-item title="SKOPE Workflow" class="text-h6 skope-title" />
    <v-divider />
    <v-list nav>
      <v-list-item
        v-for="(step, index) in steps"
        :key="index"
        :prepend-icon="step.icon"
        :title="step.label"
        :to="locations[index]"
        :disabled="isDisabled(index)"
        :append-icon="
          isStepComplete(index) ? 'mdi-check-circle-outline' : undefined
        "
      />
      <v-divider />
      <v-list-item>
        <LoadAnalysis />
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { computed } from "vue";
import LoadAnalysis from "@/components/dataset/LoadAnalysis.vue";
import { useWorkflowSteps } from "@/composables/useWorkflowSteps";
import { useAppStore } from "@/stores/app";

const appStore = useAppStore();
const { steps, locations, isDisabled, isStepComplete } = useWorkflowSteps();

const navigationVisible = computed({
  get() {
    return appStore.isNavigationVisible;
  },
  set(value: boolean) {
    appStore.setNavigationVisible(value);
  },
});
</script>
