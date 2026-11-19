import { computed } from "vue";
import { useAppStore } from "@/stores/app";
import { useDatasetStore } from "@/stores/dataset";

/**
 * The SKOPE workflow's steps, where each one leads, and which are reachable
 * from the current page. Shared by the step bar and the navigation drawer.
 */
export function useWorkflowSteps() {
  const route = useRoute();
  const appStore = useAppStore();
  const datasetStore = useDatasetStore();

  const steps = computed(() => appStore.steps);
  const variableId = computed(() => datasetStore.variable?.id);
  const hasMetadata = computed(() => route.params.id != null);
  const hasValidStudyArea = computed(
    () => hasMetadata.value && datasetStore.hasGeoJson,
  );
  // A link to visualize or analyze needs the variable; without it the router
  // throws while rendering, and the page goes blank.
  const canVisualize = computed(
    () => hasValidStudyArea.value && variableId.value != null,
  );
  const currentStepIndex = computed(() =>
    appStore.stepNames.findIndex((x) => x === (route.name as string)),
  );

  const locations = computed(() => [
    { name: "index" },
    hasMetadata.value
      ? { name: "dataset-id", params: { id: route.params.id as string } }
      : undefined,
    canVisualize.value
      ? {
          name: "dataset-id-visualize-variable",
          params: { id: route.params.id as string, variable: variableId.value },
        }
      : undefined,
    canVisualize.value
      ? {
          name: "dataset-id-analyze-variable",
          params: { id: route.params.id as string, variable: variableId.value },
        }
      : undefined,
  ]);

  function isDisabled(stepId: number) {
    switch (currentStepIndex.value) {
      case 0:
        if (stepId === 1) return !hasMetadata.value;
        if (stepId === 2) return !canVisualize.value;
        if (stepId === 3) return !canVisualize.value;
        return false;
      case 1:
        if ([2, 3].includes(stepId)) return !canVisualize.value;
        return false;
      case 2:
        if (stepId === 3) return !canVisualize.value;
        return false;
      default:
        return false;
    }
  }

  function isStepComplete(index: number) {
    return currentStepIndex.value > index;
  }

  return { steps, locations, currentStepIndex, isDisabled, isStepComplete };
}
