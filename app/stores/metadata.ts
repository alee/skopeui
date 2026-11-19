import { defineStore } from "pinia";
import type { Dataset } from "@/types/metadata";
import { timeSpan } from "@/utils/timeAxis";

function matchesYearFilter(minYear: number, maxYear: number, dataset: Dataset) {
  const [start, end] = timeSpan(dataset.time);
  return end >= minYear && start <= maxYear;
}

function matchesCategoryFilter(selectedCategories: string[], dataset: Dataset) {
  if (selectedCategories.length === 0) {
    return true;
  }
  return dataset.variables.some(
    (variable) =>
      variable.category != null &&
      selectedCategories.includes(variable.category),
  );
}

function matchesQueryFilter(query: string, dataset: Dataset) {
  if (query.length === 0) {
    return true;
  }
  const q = query.toLowerCase();
  const variableCorpus = dataset.variables
    .map((v) => `${v.category ?? ""} ${v.title} ${v.description}`.toLowerCase())
    .join(" ");
  return (
    dataset.title.toLowerCase().includes(q) ||
    dataset.description.toLowerCase().includes(q) ||
    variableCorpus.includes(q)
  );
}

export const useMetadataStore = defineStore("metadata", {
  state: () => ({
    // Set when the API serves a /metadata major version this UI can't read.
    updateRequired: false,
    allDatasetMetadata: [] as Dataset[],
    filterCriteria: {
      selectedCategories: [] as string[],
      yearStart: 1 as number | string,
      yearEnd: new Date().getFullYear() as number | string,
      query: "",
    },
  }),
  getters: {
    filteredDatasets: (state): Dataset[] => {
      const { selectedCategories, yearStart, yearEnd, query } =
        state.filterCriteria;
      return state.allDatasetMetadata.filter(
        (dataset) =>
          matchesYearFilter(Number(yearStart), Number(yearEnd), dataset) &&
          matchesQueryFilter(query, dataset) &&
          matchesCategoryFilter(selectedCategories, dataset),
      );
    },
  },
  actions: {
    find(metadataId: string) {
      return (
        this.allDatasetMetadata.find((dataset) => dataset.id === metadataId) ||
        null
      );
    },
    setUpdateRequired() {
      this.updateRequired = true;
    },
    // The API sends datasets already sorted by `order`, then ID.
    setAllDatasetMetadata(datasets: Dataset[]) {
      this.allDatasetMetadata = datasets;
    },
  },
});
