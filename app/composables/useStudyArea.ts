import { hasStudyArea } from "@/utils/studyArea";
import { useMessagesStore } from "@/stores/messages";
import { useDatasetStore } from "@/stores/dataset";
import { usePersistenceStorage } from "@/composables/usePersistenceStorage";

/** Dataset-scoped persistence for the single active, normalized study feature. */
export function useStudyArea() {
  const datasetStore = useDatasetStore();
  const messages = useMessagesStore();
  const persistenceStorage = usePersistenceStorage(() => {
    const warning =
      "Browser storage is unavailable. Study-area changes may be lost when you reload.";
    if (!messages.messages.some((message) => message.message === warning))
      messages.warning(warning);
  });

  function restore() {
    if (datasetStore.hasGeoJson) {
      return;
    }
    const key = datasetStore.geoJsonKey;
    const geoJson = Object.hasOwn(datasetStore.unpersistedStudyAreas, key)
      ? datasetStore.unpersistedStudyAreas[key]
      : persistenceStorage.get(key) || null;
    datasetStore.setGeoJson(hasStudyArea(geoJson) ? geoJson : null);
  }

  function clear() {
    const key = datasetStore.geoJsonKey;
    if (persistenceStorage.remove(key))
      delete datasetStore.unpersistedStudyAreas[key];
    else datasetStore.unpersistedStudyAreas[key] = null;
    datasetStore.clearGeoJson();
  }

  function save(geoJson: unknown) {
    const key = datasetStore.geoJsonKey;
    if (persistenceStorage.set(key, geoJson))
      delete datasetStore.unpersistedStudyAreas[key];
    else datasetStore.unpersistedStudyAreas[key] = geoJson;
    datasetStore.setGeoJson(geoJson);
  }

  return { restore, save, clear };
}
