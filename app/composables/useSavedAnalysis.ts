import { extractYear } from "@/store/stats";
import { useDatasetStore } from "@/stores/dataset";
import { useAnalysisStore } from "@/stores/analysis";
import { useDatasetMetadata } from "@/composables/useDatasetMetadata";

/** Restore selection and options before the caller navigates to Analyze. */
export function useSavedAnalysis() {
  const metadata = useDatasetMetadata();
  const dataset = useDatasetStore();
  const analysis = useAnalysisStore();

  async function restore(request: Record<string, any>) {
    const initialized = await metadata.initializeDataset(
      request.dataset_id,
      request.variable_id,
    );
    if (
      !initialized ||
      dataset.metadata?.id !== request.dataset_id ||
      dataset.variable.id !== request.variable_id
    ) {
      throw new Error(
        "Unable to initialize the saved analysis dataset and variable.",
      );
    }
    dataset.setTemporalRange([
      extractYear(request.time_range.gte),
      extractYear(request.time_range.lte),
    ]);
    // Imported geometry is active state; drawing/saving remains an explicit
    // persistence operation through useStudyArea.
    dataset.setGeoJson(request.selected_area);
    analysis.setRequestData(request);
  }

  return { restore };
}
