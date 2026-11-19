import { extractYear } from "@/utils/stats";
import { useDatasetStore } from "@/stores/dataset";
import { useMetadataStore } from "@/stores/metadata";
import { useAnalysisStore } from "@/stores/analysis";
import { useDatasetMetadata } from "@/composables/useDatasetMetadata";
import { stableJson } from "@/utils/extractionIdentity";
import {
  parseSavedAnalysis,
  validateSavedAnalysisDataset,
  SavedAnalysisValidationError,
} from "@/utils/savedAnalysis";

/** Validate the complete import before committing selection and options. */
export function useSavedAnalysis() {
  const metadata = useDatasetMetadata();
  const dataset = useDatasetStore();
  const analysis = useAnalysisStore();
  const metadataStore = useMetadataStore();
  const context = () =>
    stableJson([
      dataset.initializationVersion,
      dataset.defaultApiRequestData,
      analysis.requestOptions,
    ]);

  async function restore(input: unknown) {
    const request = parseSavedAnalysis(input);
    const previous = context();
    const catalog = await metadata.fetchDatasetMetadata();
    if (context() !== previous)
      throw new SavedAnalysisValidationError(
        "Unable to initialize the saved analysis: the active selection changed during import.",
      );
    const selected = catalog.find((entry) => entry.id === request.dataset_id);
    validateSavedAnalysisDataset(request, selected);
    // No awaits after validation: consumers observe the completed selection.
    metadataStore.setAllDatasetMetadata(catalog);
    dataset.setMetadata(selected);
    dataset.setVariable(request.variable_id);
    dataset.setTemporalRange([
      extractYear(request.time_range.gte),
      extractYear(request.time_range.lte),
    ]);
    // Importing does not overwrite the dataset's persisted study area.
    dataset.setGeoJson(request.selected_area);
    analysis.setRequestData(request);
    return request;
  }
  return { restore };
}
