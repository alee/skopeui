import { computed, onScopeDispose, ref } from "vue";
import { useDatasetMetadata } from "@/composables/useDatasetMetadata";
import { useDatasetStore } from "@/stores/dataset";

export type DatasetPageState = "loading" | "ready" | "error" | "not-found";

/** Page-owned load state; a missing selection is not an unfinished request. */
export function useDatasetPage(datasetId: string, variableId?: string) {
  const metadata = useDatasetMetadata();
  const dataset = useDatasetStore();
  const outcome = ref<"loading" | "loaded" | "error">("loading");
  let version = 0;
  let disposed = false;
  onScopeDispose(() => {
    disposed = true;
  });

  const state = computed<DatasetPageState>(() => {
    if (outcome.value !== "loaded") return outcome.value;
    return dataset.metadata?.id === datasetId &&
      (variableId == null || dataset.variable.id === variableId)
      ? "ready"
      : "not-found";
  });

  async function load() {
    const current = ++version;
    outcome.value = "loading";
    try {
      const initialized =
        variableId == null
          ? await metadata.initializeDataset(datasetId)
          : await metadata.initializeDataset(datasetId, variableId);
      if (disposed || current !== version) return false;
      outcome.value = "loaded";
      return initialized && state.value === "ready";
    } catch {
      if (!disposed && current === version) outcome.value = "error";
      return false;
    }
  }

  return { state, load };
}
