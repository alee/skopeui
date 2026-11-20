import { flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAppStore,
  createDatasetStore,
  timeSeriesResponseFixture,
} from "@/tests/fixtures/page-fixtures";
import {
  installNuxtTestGlobals,
  mountWithSuspense,
  resetNuxtTestGlobals,
} from "@/tests/fixtures/nuxt-test-helpers";

import VisualizePage from "@/pages/dataset/[id]/visualize/[variable].vue";
import { RequestFailure } from "@/utils/requestJson";

const routeParams = { id: "paleocar", variable: "tasmax" };
let datasetStore: any;
let appStore: any;
let metadataActions: any;
let studyArea: any;
let extractionStore: any;

vi.mock("@/components/dataset/Map.client.vue", () => ({
  default: {
    name: "MapStub",
    props: ["displayRaster", "step", "preloadStep"],
    template:
      '<div data-test="map" :data-display-raster="String(displayRaster)">map<slot name="footer" /></div>',
  },
}));

vi.mock("@/components/dataset/RasterPlaybackControls.vue", () => ({
  default: {
    name: "RasterPlaybackControlsStub",
    props: ["stepSelected", "isPlaying", "canPlay", "isStepLoading"],
    emits: ["step-selected", "toggle-playback"],
    template: '<div data-test="map-playback" />',
  },
}));

vi.mock("@/components/dataset/TimeSeriesPlot.vue", () => ({
  default: {
    name: "TimeSeriesPlotStub",
    template: '<div data-test="timeseries">timeseries</div>',
  },
}));

vi.mock("@/components/dataset/SubHeader.vue", () => ({
  default: {
    name: "SubHeaderStub",
    template: '<div data-test="subheader"><slot /></div>',
  },
}));

vi.mock("@/components/LoadingSpinner.vue", () => ({
  default: {
    name: "LoadingSpinnerStub",
    template: '<div data-test="loading">loading</div>',
  },
}));

vi.mock("@/stores/dataset", () => ({
  useDatasetStore: () => datasetStore,
}));

vi.mock("@/stores/analysis", () => ({
  useAnalysisStore: () => ({}),
}));

vi.mock("@/stores/app", () => ({
  useAppStore: () => appStore,
}));

vi.mock("@/stores/messages", () => ({
  useMessagesStore: () => ({
    error: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock("@/stores/extraction", () => ({
  useExtractionStore: () => extractionStore,
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
  "v-btn": {
    props: ["to"],
    template: '<button :data-to="to && JSON.stringify(to)"><slot /></button>',
  },
  "v-icon": { template: "<i><slot /></i>" },
};

describe("route /dataset/:id/visualize/:variable", () => {
  beforeEach(() => {
    vi.stubGlobal("useRoute", () => ({
      params: routeParams,
      fullPath: `/dataset/${routeParams.id}/visualize/${routeParams.variable}`,
    }));
    installNuxtTestGlobals();

    datasetStore = createDatasetStore({ hasGeoJson: true });
    appStore = createAppStore();
    metadataActions = { initializeDataset: vi.fn(async () => true) };
    studyArea = { restore: vi.fn() };
    extractionStore = {
      beginRequest: () => () => true,
      resolveTimeSeries: vi.fn(async () => timeSeriesResponseFixture),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetNuxtTestGlobals();
  });

  it("[smoke] renders map and timeseries panel", async () => {
    const wrapper = await mountWithSuspense(VisualizePage, {
      global: { stubs: layoutStubs },
    });

    await flushPromises();
    const page = wrapper.findComponent(VisualizePage);
    const map = page.find('[data-test="map"]');

    expect(page.findComponent({ name: "MapStub" }).exists()).toBe(true);
    expect(map.attributes("data-display-raster")).toBe("true");
    expect(map.find('[data-test="map-playback"]').exists()).toBe(true);
    expect(page.findComponent({ name: "TimeSeriesPlotStub" }).exists()).toBe(
      true,
    );
  });

  it("[behavior] map controls select a frame and reflect when it is ready", async () => {
    const wrapper = await mountWithSuspense(VisualizePage, {
      global: { stubs: layoutStubs },
    });
    await flushPromises();
    const map = wrapper.findComponent({ name: "MapStub" });
    const controls = wrapper.findComponent({
      name: "RasterPlaybackControlsStub",
    });
    controls.vm.$emit("step-selected", 2);
    await nextTick();
    expect(map.props("step")).toBe(2);
    expect(controls.props("isStepLoading")).toBe(true);
    map.vm.$emit("step-ready", 2);
    await nextTick();
    expect(controls.props("stepSelected")).toBe(2);
    expect(controls.props("isStepLoading")).toBe(false);
    wrapper.unmount();
  });

  it("[behavior] passes lookahead to the map only while playing a ready frame", async () => {
    datasetStore.metadata = {
      ...datasetStore.metadata,
      time: {
        kind: "regular",
        origin: "0001",
        end: "0003",
        step: "P1Y",
        count: 3,
      },
    };
    const wrapper = await mountWithSuspense(VisualizePage, {
      global: { stubs: layoutStubs },
    });
    await flushPromises();
    const map = wrapper.findComponent({ name: "MapStub" });
    const controls = wrapper.findComponent({
      name: "RasterPlaybackControlsStub",
    });
    map.vm.$emit("step-ready", 1);
    await nextTick();
    controls.vm.$emit("toggle-playback");
    await nextTick();
    expect(map.props("preloadStep")).toBe(2);
    expect(controls.props("stepSelected")).toBe(1);
    expect(controls.props("isStepLoading")).toBe(false);
    controls.vm.$emit("toggle-playback");
    await nextTick();
    expect(map.props("preloadStep")).toBeNull();
    wrapper.unmount();
  });

  it("[behavior] restores the last selected map year on return", async () => {
    datasetStore.metadata = {
      ...datasetStore.metadata,
      time: {
        kind: "regular",
        origin: "0001",
        end: "0003",
        step: "P1Y",
        count: 3,
      },
    };
    const mountPage = () =>
      mountWithSuspense(VisualizePage, { global: { stubs: layoutStubs } });
    const first = await mountPage();
    await flushPromises();
    first
      .findComponent({ name: "RasterPlaybackControlsStub" })
      .vm.$emit("step-selected", 2);
    await nextTick();
    first.unmount();
    expect(datasetStore.visualizeStep).toBe(2);
    const second = await mountPage();
    await flushPromises();
    expect(second.findComponent({ name: "MapStub" }).props("step")).toBe(2);
    second.unmount();
  });

  it("[behavior] offers an edit-area link that returns to visualize", async () => {
    const wrapper = await mountWithSuspense(VisualizePage, {
      global: { stubs: layoutStubs },
    });
    await flushPromises();
    const edit = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Edit study area"))!;
    expect(JSON.parse(edit.attributes("data-to")!)).toEqual({
      name: "dataset-id",
      params: { id: "paleocar" },
      query: { returnTo: "visualize" },
    });
    wrapper.unmount();
  });

  it("[behavior] drops the analyze link instead of throwing while leaving", async () => {
    // Mid-navigation the route can lack the variable; a link built from it
    // made the router throw during render.
    const wrapper = await mountWithSuspense(VisualizePage, {
      global: { stubs: layoutStubs },
    });
    await flushPromises();
    const analyze = () =>
      wrapper.findAll("button").find((b) => b.text().includes("Analyze Data"))!;
    expect(analyze().attributes("data-to")).toBeDefined();

    const variable = routeParams.variable;
    delete (routeParams as any).variable;
    try {
      const fresh = await mountWithSuspense(VisualizePage, {
        global: { stubs: layoutStubs },
      });
      await flushPromises();
      const link = fresh
        .findAll("button")
        .find((b) => b.text().includes("Analyze Data"))!;
      expect(link.attributes("data-to")).toBeUndefined();
    } finally {
      routeParams.variable = variable;
    }
  });

  it("[behavior] loads time-series data on mount", async () => {
    await mountWithSuspense(VisualizePage, { global: { stubs: layoutStubs } });

    await flushPromises();

    expect(datasetStore.setTimeSeriesLoading).toHaveBeenCalled();
    expect(datasetStore.setTimeSeries).toHaveBeenCalledWith(
      expect.objectContaining({
        timeSeries: expect.objectContaining({ x: [1, 2, 3], y: [10, 20, 30] }),
      }),
    );
    expect(datasetStore.setTimeSeriesLoaded).toHaveBeenCalled();
    expect(extractionStore.resolveTimeSeries).toHaveBeenCalled();
    expect(appStore.setVisited).toHaveBeenCalled();
  });

  it("[behavior] retries the unchanged time-series request without reloading", async () => {
    datasetStore.setTimeSeriesLoading.mockImplementation(() => {
      datasetStore.timeSeriesRequestStatus = {
        status: "loading",
        messages: [],
      };
    });
    datasetStore.setTimeSeriesServerError.mockImplementation(() => {
      datasetStore.timeSeriesRequestStatus = {
        status: "servererror",
        messages: [],
      };
    });
    datasetStore.setTimeSeriesLoaded.mockImplementation(() => {
      datasetStore.timeSeriesRequestStatus = {
        status: "success",
        messages: [],
      };
    });
    extractionStore.resolveTimeSeries.mockRejectedValueOnce(
      new RequestFailure("POLLING_TIMEOUT", "Retry to reconnect."),
    );
    const wrapper = await mountWithSuspense(VisualizePage, {
      global: { stubs: layoutStubs },
    });
    await flushPromises();
    const request = extractionStore.resolveTimeSeries.mock.calls[0][0];
    const retry = wrapper
      .findAll("button")
      .find((button) => button.text() === "Retry time series")!;
    expect(retry).toBeDefined();
    let finish!: (value: unknown) => void;
    extractionStore.resolveTimeSeries.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await retry.trigger("click");
    expect(extractionStore.resolveTimeSeries).toHaveBeenCalledTimes(2);
    expect(extractionStore.resolveTimeSeries).toHaveBeenLastCalledWith(request);
    expect(
      wrapper
        .findAll("button")
        .some((button) => button.text() === "Retry time series"),
    ).toBe(false);
    finish(timeSeriesResponseFixture);
    await flushPromises();
    expect(datasetStore.timeSeriesRequestStatus.status).toBe("success");
    wrapper.unmount();
  });

  it("[behavior] can recover from a failed metadata load", async () => {
    const metadata = datasetStore.metadata;
    datasetStore.metadata = null;
    metadataActions.initializeDataset.mockRejectedValueOnce(
      new Error("offline"),
    );
    const wrapper = await mountWithSuspense(VisualizePage, {
      global: { stubs: layoutStubs },
    });
    expect(wrapper.find('[role="alert"]').text()).toContain(
      "Unable to load this dataset",
    );
    metadataActions.initializeDataset.mockImplementationOnce(async () => {
      datasetStore.metadata = metadata;
      return true;
    });
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Retry")!
      .trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-test="map"]').exists()).toBe(true);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("[behavior] re-requests time-series when temporal/request constraints change", async () => {
    await mountWithSuspense(VisualizePage, { global: { stubs: layoutStubs } });

    await flushPromises();

    datasetStore.timeSeriesRequestData = {
      dataset_id: "paleocar",
      variable_id: "tasmax",
      selected_area: { type: "FeatureCollection", features: [] },
      time_range: { gte: "0002-01-01", lte: "0003-01-01" },
      zonal_statistic: "mean",
      transform: { type: "NoTransform" },
      requested_series_options: [
        { name: "Original", smoother: { type: "NoSmoother" } },
      ],
    };

    await nextTick();
    await flushPromises();

    expect(extractionStore.resolveTimeSeries).toHaveBeenCalledTimes(2);
  });
});
