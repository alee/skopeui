import { hasStudyArea } from "@/utils/studyArea";
import { usePersistenceStorage } from "@/composables/usePersistenceStorage";
import { studyAreaKey, useDatasetStore } from "@/stores/dataset";
import { useMessagesStore } from "@/stores/messages";

// Visualize and analyze need a study area. Without one, send the user to draw
// it. The area lives in the browser, so the check only runs there.
export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return;
  const datasetId = String(to.params.id);
  const datasetStore = useDatasetStore();
  if (datasetStore.hasGeoJson && datasetStore.metadata?.id === datasetId) {
    return;
  }
  if (hasStudyArea(usePersistenceStorage().get(studyAreaKey(datasetId))))
    return;

  useMessagesStore().info(
    "Select a study area first: draw one on the map, or upload a GeoJSON file.",
    { keepOnNavigation: true },
  );
  return navigateTo({ name: "dataset-id", params: { id: datasetId } });
});
