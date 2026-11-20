import { flushPromises } from "@vue/test-utils";
import { nextTick, ref } from "vue";
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
let postedStudyArea = ref<unknown>(null);

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
  "v-alert": { template: '<div role="alert"><slot /></div>' },
  "v-container": { template: "<div><slot /></div>" },
  "v-row": { template: "<div><slot /></div>" },
  "v-col": { template: "<div><slot /></div>" },
  "client-only": { template: "<div><slot /></div>" },
  "v-dialog": {
    props: ["modelValue"],
    template:
      '<div v-if="modelValue" data-test="area-confirmation"><slot /></div>',
  },
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
    postedStudyArea = ref(null);
    vi.stubGlobal("useState", () => postedStudyArea);

    routeParams = { id: "paleocar" };
    datasetStore = createDatasetStore({ hasGeoJson: false });
    appStore = createAppStore();
    metadataActions = { initializeDataset: vi.fn(async () => true) };
    studyArea = { clear: vi.fn(), save: vi.fn() };
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetNuxtTestGlobals();
  });

  it("imports a posted feature after metadata loads without prompting to clear it", async () => {
    const feature = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Point",
        coordinates: [-107.971802, 36.048799],
      },
    };
    postedStudyArea.value = feature;
    studyArea.save.mockImplementation(() => {
      datasetStore.hasGeoJson = true;
    });
    const wrapper = await mountWithSuspense(DatasetIdPage, {
      global: { stubs: layoutStubs },
    });
    expect(studyArea.save).toHaveBeenCalledWith(feature);
    expect(postedStudyArea.value).toBeNull();
    wrapper.findComponent({ name: "MapStub" }).vm.$emit("map-ready", true);
    await nextTick();
    expect(wrapper.find('[data-test="area-confirmation"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.find('[data-test="btn"]').attributes("disabled"),
    ).toBeUndefined();
    wrapper.unmount();
  });

  it("keeps the posted feature through a metadata failure and imports it on retry", async () => {
    postedStudyArea.value = { type: "Point", coordinates: [-108, 36] };
    metadataActions.initializeDataset.mockRejectedValueOnce(
      new Error("offline"),
    );
    const wrapper = await mountWithSuspense(DatasetIdPage, {
      global: { stubs: layoutStubs },
    });
    expect(studyArea.save).not.toHaveBeenCalled();
    expect(postedStudyArea.value).not.toBeNull();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Retry")!
      .trigger("click");
    await flushPromises();
    expect(studyArea.save).toHaveBeenCalledTimes(1);
    expect(postedStudyArea.value).toBeNull();
    wrapper.unmount();
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

  it("waits until the map has restored the saved area before asking to clear it", async () => {
    datasetStore.hasGeoJson = true;
    appStore.isFirstVisit = true;
    const wrapper = await mountWithSuspense(DatasetIdPage, {
      global: { stubs: layoutStubs },
    });
    expect(wrapper.find('[data-test="area-confirmation"]').exists()).toBe(
      false,
    );
    wrapper.findComponent({ name: "MapStub" }).vm.$emit("map-ready", true);
    await nextTick();
    expect(wrapper.find('[data-test="area-confirmation"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("does not ask to clear a nonexistent area after the map loads", async () => {
    const wrapper = await mountWithSuspense(DatasetIdPage, {
      global: { stubs: layoutStubs },
    });
    wrapper.findComponent({ name: "MapStub" }).vm.$emit("map-ready", true);
    await nextTick();
    expect(wrapper.find('[data-test="area-confirmation"]').exists()).toBe(
      false,
    );
    wrapper.unmount();
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

  it("[behavior] replaces a failed metadata spinner with Retry and Back actions", async () => {
    const metadata = datasetStore.metadata;
    datasetStore.metadata = null;
    metadataActions.initializeDataset.mockRejectedValueOnce(
      new Error("offline"),
    );
    const wrapper = await mountWithSuspense(DatasetIdPage, {
      global: { stubs: layoutStubs },
    });
    expect(wrapper.find('[role="alert"]').text()).toContain(
      "Unable to load this dataset",
    );
    expect(wrapper.find('[data-test="loading"]').exists()).toBe(false);
    const back = wrapper
      .findAll("button")
      .find((button) => button.text() === "Back to datasets")!;
    expect(JSON.parse(back.attributes("data-to")!)).toEqual({ name: "index" });
    let finish!: (value: boolean) => void;
    metadataActions.initializeDataset.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Retry")!
      .trigger("click");
    expect(wrapper.find('[data-test="loading"]').exists()).toBe(true);
    datasetStore.metadata = metadata;
    finish(true);
    await flushPromises();
    expect(wrapper.find('[data-test="map"]').exists()).toBe(true);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("[behavior] presents an unavailable dataset without an endless spinner", async () => {
    datasetStore.metadata = null;
    metadataActions.initializeDataset.mockResolvedValueOnce(false);
    const wrapper = await mountWithSuspense(DatasetIdPage, {
      global: { stubs: layoutStubs },
    });
    expect(wrapper.find('[role="alert"]').text()).toContain(
      "dataset or variable is unavailable",
    );
    expect(wrapper.find('[data-test="loading"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
