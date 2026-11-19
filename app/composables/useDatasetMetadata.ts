import { createApiEndpoints } from "@/utils/apiEndpoints";
import { useRuntimeConfig } from "nuxt/app";
import { requestJson } from "@/utils/requestJson";
import {
  datasetsFromMetadata,
  UnsupportedMetadataVersionError,
} from "@/utils/metadataResponse";
import { useDatasetStore } from "@/stores/dataset";
import { useMetadataStore } from "@/stores/metadata";
import { useStudyArea } from "@/composables/useStudyArea";

export function useDatasetMetadata() {
  const endpoints = createApiEndpoints(useRuntimeConfig().public.apiBase);
  const metadataStore = useMetadataStore();
  const datasetStore = useDatasetStore();
  const studyArea = useStudyArea();

  // Fetched on every page change, not cached, so a UI left open across an API
  // deploy notices a changed schema version on its next navigation (CUT-001).
  async function fetchDatasetMetadata() {
    return datasetsFromMetadata(await requestJson(endpoints.metadata));
  }

  async function loadAllDatasetMetadata() {
    try {
      metadataStore.setAllDatasetMetadata(await fetchDatasetMetadata());
      const activeId = datasetStore.metadata?.id;
      if (activeId) datasetStore.setMetadata(metadataStore.find(activeId));
    } catch (error) {
      if (error instanceof UnsupportedMetadataVersionError) {
        metadataStore.setUpdateRequired();
      }
      throw error;
    }
  }

  async function initializeDataset(
    metadataId: string,
    variableId?: string | null,
  ) {
    // Already loaded (moving between its steps): don't wait for the metadata
    // request, which can sit behind a running extraction and held up the next
    // page. Still send it, so a changed API is noticed (CUT-001); a version
    // mismatch flags the update screen, and other failures can wait for the
    // next page.
    if (metadataId === datasetStore.metadata?.id) {
      datasetStore.beginInitialization();
      if (variableId != null) datasetStore.setVariable(variableId);
      loadAllDatasetMetadata().catch(() => undefined);
      return true;
    }

    // A different dataset must not display or submit the previous selection
    // while its metadata is loading.
    datasetStore.setMetadata(null);
    const isCurrent = datasetStore.beginInitialization();
    await loadAllDatasetMetadata();
    if (!isCurrent()) return false;

    const datasetMetadata = metadataStore.find(metadataId);
    if (datasetMetadata == null) {
      datasetStore.setMetadata(null);
      return false;
    }

    datasetStore.setMetadata(datasetMetadata);

    if (variableId != null) datasetStore.setVariable(variableId);

    if (typeof window !== "undefined") {
      studyArea.restore();
    }
    return true;
  }

  return { loadAllDatasetMetadata, initializeDataset, fetchDatasetMetadata };
}
