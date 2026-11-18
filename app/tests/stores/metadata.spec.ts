import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useMetadataStore } from "@/stores/metadata";
import metadataFixture from "@/tests/fixtures/metadata-1.0.0.json";
import type { Dataset } from "@/types/metadata";

const [original] = metadataFixture.datasets as Dataset[];
const other: Dataset = {
  ...original,
  id: "other",
  title: "Other dataset",
  variables: [],
};

beforeEach(() => setActivePinia(createPinia()));

describe("catalog filtering", () => {
  it("keeps filters active when the catalog refreshes, including new matches", () => {
    const store = useMetadataStore();
    store.setAllDatasetMetadata([other, original]);
    store.setFilterCriteria({
      selectedCategories: ["Precipitation"],
      yearStart: 1000,
      yearEnd: 1200,
      query: "tree-ring",
    });
    expect(store.filteredDatasets.map((dataset) => dataset.id)).toEqual([
      original.id,
    ]);
    const added = { ...original, id: "added" };
    store.setAllDatasetMetadata([other, added, original]);
    expect(store.filteredDatasets.map((dataset) => dataset.id)).toEqual([
      "added",
      original.id,
    ]);
    expect(store.filterCriteria.query).toBe("tree-ring");
  });

  it("derives the list immediately from criteria edits without changing the catalog", () => {
    const store = useMetadataStore();
    store.setAllDatasetMetadata([other, original]);
    store.filterCriteria.query = "Other dataset";
    expect(store.filteredDatasets.map((dataset) => dataset.id)).toEqual([
      "other",
    ]);
    store.filterCriteria.query = "";
    store.filterCriteria.yearStart = 2001;
    expect(store.filteredDatasets).toEqual([]);
    store.filterCriteria.yearStart = 1;
    expect(store.filteredDatasets.map((dataset) => dataset.id)).toEqual([
      "other",
      original.id,
    ]);
    expect(store.allDatasetMetadata).toEqual([other, original]);
  });
});
