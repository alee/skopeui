import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import { useAnalysisStore } from "@/stores/analysis";
import { useDatasetStore } from "@/stores/dataset";
import { useMessagesStore } from "@/stores/messages";
import { useMetadataStore } from "@/stores/metadata";
import type { Dataset } from "@/types/metadata";
import metadataFixture from "@/tests/fixtures/metadata-1.0.0.json";

describe("stores", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("messages store keeps only the messages raised for the page being opened", () => {
    const store = useMessagesStore();

    store.error("from the last page");
    store.info("for the next page", { keepOnNavigation: true });
    store.clearOnNavigation();
    expect(store.messages).toEqual([
      { type: "info", message: "for the next page" },
    ]);

    store.clearOnNavigation();
    expect(store.messages).toEqual([]);
  });

  it("dataset store stops time-series requests once the metadata is cleared", () => {
    // The landing page clears the metadata while visualize is still on screen;
    // a request then went out without a dataset and came back 422.
    const store = useDatasetStore();
    store.setMetadata(metadataFixture.datasets[0] as Dataset);
    store.setVariable("ppt_annual");
    store.setGeoJson({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [-108.5, 37] },
    });
    expect(store.canHandleTimeSeriesRequest).toBe(true);

    store.setMetadata(null);
    expect(store.canHandleTimeSeriesRequest).toBe(false);
  });

  it("dataset store derives the axis, request and area from its state", () => {
    const store = useDatasetStore();

    store.setMetadata(metadataFixture.datasets[0] as Dataset);
    store.setVariable("gdd_cotton_annual");
    store.setGeoJson({ type: "FeatureCollection", features: [] });

    expect(store.minYear).toBe(103);
    expect(store.maxYear).toBe(2000);
    expect(store.variable.title).toBe(
      "Annual (Jan–Dec) Cotton Growing Degree Days",
    );
    expect(store.geoJsonKey).toBe("geojson:paleocar_v3");
    expect(store.defaultApiRequestData.dataset_id).toBe("paleocar_v3");
    expect(store.defaultApiRequestData.variable_id).toBe("gdd_cotton_annual");

    store.setTimeSeries({
      timeSeries: { x: [1, 2, 3], y: [1, 2, 3], options: { name: "Original" } },
      numberOfCells: 2,
      area: 2000000,
    });
    expect(store.numberOfCells).toBe(2);
    expect(store.areaInSquareKm).toBe(2);

    store.clearTimeSeries();
    expect(store.timeSeries.x).toEqual([]);
    expect(store.numberOfCells).toBe(0);
  });

  it("dataset store keeps the points of the selected years, empty ones included", () => {
    const store = useDatasetStore();

    store.setMetadata(metadataFixture.datasets[0] as Dataset);
    store.setTemporalRange([416, 418]);
    store.setTimeSeries({
      timeSeries: {
        x: [415, 416, 417, 418, 419],
        y: [1, 2, null, null, 5],
        options: { name: "Original" },
      },
      numberOfCells: 2,
      area: 2000000,
    });

    expect(store.filteredTimeSeries()).toEqual({
      x: [416, 417, 418],
      y: [2, null, null],
      name: "Original",
    });
  });

  it("metadata store finds and filters datasets", () => {
    const store = useMetadataStore();
    const paleocar = metadataFixture.datasets[0]! as Dataset;
    const lbda: Dataset = {
      ...paleocar,
      id: "lbda",
      title: "LBDA",
      description: "drought index",
      time: { ...paleocar.time, origin: "0001", end: "2017" },
      variables: [
        {
          ...paleocar.variables[0]!,
          id: "pmdi",
          title: "PMDI",
          category: "Drought",
          description: "index",
        },
      ],
    };
    store.setAllDatasetMetadata([lbda, paleocar]);

    expect(store.find("lbda")?.title).toBe("LBDA");
    expect(store.find("missing")).toBeNull();

    store.filterCriteria = {
      selectedCategories: ["Precipitation"],
      yearStart: 1,
      yearEnd: 2005,
      query: "tree-ring",
    };
    expect(store.filteredDatasets.map((d) => d.id)).toEqual(["paleocar_v3"]);

    store.filterCriteria = {
      selectedCategories: [],
      yearStart: 2001,
      yearEnd: 2017,
      query: "",
    };
    expect(store.filteredDatasets.map((d) => d.id)).toEqual(["lbda"]);
  });

  it("analysis store reads the response and keeps the request when cleared", () => {
    const store = useAnalysisStore();

    useDatasetStore().setMetadata(metadataFixture.datasets[0] as Dataset);
    store.setDefaultRequestData({ zonal_statistic: "median" });
    useDatasetStore().setGeoJson({ type: "FeatureCollection", features: [] });
    expect(store.requestData).toMatchObject({
      dataset_id: "paleocar_v3",
      zonal_statistic: "median",
      selected_area: { type: "FeatureCollection", features: [] },
    });

    store.setResponse({
      summary_stats: [{ name: "Original", stdev: 2, mean: 3, median: 3 }],
      series: [
        {
          time_range: { gte: "0416", lte: "0590" },
          timesteps: ["0416", "0417", "0590"],
          values: [1, null, 3],
          options: { name: "Original" },
        },
      ],
    } as any);
    expect(store.summaryStatistics[0]!.name).toBe("Original");
    expect(store.timeseries[0]!.x).toEqual([416, 417, 590]);
    expect(store.timeseries[0]!.y).toEqual([1, null, 3]);

    store.clear();
    expect(store.timeseries).toEqual([]);
    expect(store.summaryStatistics).toEqual([]);
    expect(store.requestData.dataset_id).toBe("paleocar_v3");
  });
});
