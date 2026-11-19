import { flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAppStore,
  createDatasetStore,
} from "@/tests/fixtures/page-fixtures";
import {
  installNuxtTestGlobals,
  mountWithSuspense,
  resetNuxtTestGlobals,
} from "@/tests/fixtures/nuxt-test-helpers";

import DatasetIdPage from "@/pages/dataset/[id]/index.vue";

let routeParams = { id: "paleocar" };
let routeQuery: Record<string, string> = {};
let datasetStore: any;
let appStore: any;
let metadataActions: any;
let studyArea: any;

vi.mock("@/components/LoadingSpinner.vue", () => ({
  default: {
    name: "LoadingSpinnerStub",
    template: '<div data-test="loading">loading</div>',
  },
}));

vi.mock("@/components/dataset/SubHeader.vue", () => ({
  default: {
    name: "SubHeaderStub",
    template: '<div data-test="subheader"><slot /></div>',
  },
}));

vi.mock("@/components/dataset/Map.client.vue", () => ({
  default: {
    name: "MapStub",
    props: ["displayRaster", "step"],
    template:
      '<div data-test="map" :data-display-raster="String(displayRaster)" :data-step="step">map</div>',
  },
}));

vi.mock("@/stores/dataset", () => ({
  useDatasetStore: () => datasetStore,
}));

vi.mock("@/stores/app", () => ({
  useAppStore: () => appStore,
}));

vi.mock("@/composables/useDatasetMetadata", () => ({
  useDatasetMetadata: () => metadataActions,
}));
vi.mock("@/composables/useStudyArea", () => ({
  useStudyArea: () => studyArea,
}));

const layoutStubs = {
  "v-container": { template: "<div><slot /></div>" },
  "v-row": { template: "<div><slot /></div>" },
  "v-col": { template: "<div><slot /></div>" },
  "client-only": { template: "<div><slot /></div>" },
  "v-dialog": { template: "<div><slot /></div>" },
  "v-card": { template: "<div><slot /></div>" },
  "v-card-text": { template: "<div><slot /></div>" },
  "v-card-actions": { template: "<div><slot /></div>" },
  "v-icon": { template: "<i><slot /></i>" },
  "v-btn": {
    props: ["disabled", "to"],
    template:
      '<button data-test="btn" :disabled="disabled" :data-to="to && JSON.stringify(to)"><slot /></button>',
  },
};

describe("route /dataset/:id", () => {
  beforeEach(() => {
    vi.stubGlobal("useRoute", () => ({
      params: routeParams,
      query: routeQuery,
    }));
    installNuxtTestGlobals();

    routeParams = { id: "paleocar" };
    datasetStore = createDatasetStore({ hasGeoJson: false });
    appStore = createAppStore();
    metadataActions = { initializeDataset: vi.fn(async () => true) };
    studyArea = { clear: vi.fn() };
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetNuxtTestGlobals();
  });

  it.each([103, 1000])(
    "[smoke] shows the selection map at the dataset's first timestep (%i)",
    async (firstYear) => {
      datasetStore.minYear = firstYear;
      datasetStore.setTemporalRange([1500, 1800]);
      const wrapper = await mountWithSuspense(DatasetIdPage, {
        global: { stubs: layoutStubs },
      });

      await flushPromises();
      const map = wrapper
        .findComponent(DatasetIdPage)
        .find('[data-test="map"]');

      expect(metadataActions.initializeDataset).toHaveBeenCalledWith(
        "paleocar",
      );
      expect(map.attributes("data-display-raster")).toBe("true");
      expect(map.attributes("data-step")).toBe(String(firstYear));
    },
  );

  it("[behavior] returns directly to analysis after editing its study area", async () => {
    routeQuery = { returnTo: "analyze" };
    try {
      const wrapper = await mountWithSuspense(DatasetIdPage, {
        global: { stubs: layoutStubs },
      });
      await flushPromises();
      const next = wrapper
        .findAll("button")
        .find((button) => button.text().includes("Return to analysis"))!;
      expect(JSON.parse(next.attributes("data-to")!)).toMatchObject({
        name: "dataset-id-analyze-variable",
        params: { id: "paleocar", variable: "tasmax" },
      });
      wrapper.unmount();
    } finally {
      routeQuery = {};
    }
  });

  it("[behavior] enables Visualize button only when study area is valid", async () => {
    const wrapper = await mountWithSuspense(DatasetIdPage, {
      global: { stubs: layoutStubs },
    });
    const page = wrapper.findComponent(DatasetIdPage);

    const visualizeButton = page.find('[data-test="btn"]');
    expect(visualizeButton.attributes("disabled")).toBeDefined();

    datasetStore.hasGeoJson = true;
    await nextTick();

    expect(visualizeButton.attributes("disabled")).toBeUndefined();
  });
});
