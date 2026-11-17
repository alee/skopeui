import { useDatasetStore } from "@/stores/dataset";
import { usePersistenceStorage } from "@/composables/usePersistenceStorage";

/** Dataset-scoped persistence for the single active, normalized study feature. */
export function useStudyArea() {
  const datasetStore = useDatasetStore();
  const persistenceStorage = usePersistenceStorage();

  function restore() {
    if (datasetStore.hasGeoJson) {
      return;
    }
    const geoJson = persistenceStorage.get(datasetStore.geoJsonKey) || null;
    datasetStore.setGeoJson(geoJson);
  }

  function clear() {
    persistenceStorage.remove(datasetStore.geoJsonKey);
    datasetStore.clearGeoJson();
  }

  function save(geoJson: unknown) {
    persistenceStorage.set(datasetStore.geoJsonKey, geoJson);
    datasetStore.setGeoJson(geoJson);
  }

  return { restore, save, clear };
}
