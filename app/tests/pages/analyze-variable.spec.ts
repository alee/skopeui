import JSZip from "jszip";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAnalysisStore,
  createDatasetStore,
  timeSeriesResponseFixture,
} from "@/tests/fixtures/page-fixtures";
import {
  installNuxtTestGlobals,
  mountWithSuspense,
  resetNuxtTestGlobals,
} from "@/tests/fixtures/nuxt-test-helpers";

import AnalyzePage from "@/pages/dataset/[id]/analyze/[variable].vue";

const routeParams = { id: "paleocar", variable: "tasmax" };
let analysisStore: any;
let datasetStore: any;
let metadataActions: any;
let studyArea: any;
let extractionStore: any;
let messagesStore: any;
let saveAs: ReturnType<typeof vi.fn>;
const imageExport = vi.hoisted(() => vi.fn());

vi.mock("vuetify", () => ({
  useDisplay: () => ({ mdAndDown: false }),
}));

vi.mock("@/components/dataset/TimeSeriesPlot.vue", () => ({
  default: {
    name: "TimeSeriesPlotStub",
    props: ["yAxisLabel", "traces"],
    template: '<div data-test="timeseries">timeseries</div>',
    emits: ["plot-ready"],
    mounted(this: { $emit: (event: "plot-ready", ready: boolean) => void }) {
      this.$emit("plot-ready", true);
    },
    methods: {
      getTimeSeriesPlotImage: (traces: unknown) => imageExport(traces),
    },
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

vi.mock("@/stores/analysis", () => ({
  useAnalysisStore: () => analysisStore,
}));

vi.mock("@/stores/dataset", () => ({
  useDatasetStore: () => datasetStore,
}));

vi.mock("@/stores/messages", () => ({
  useMessagesStore: () => messagesStore,
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
  "v-form": {
    methods: { validate: async () => ({ valid: true }) },
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: '<form data-test="analysis-form"><slot /></form>',
  },
  "v-data-table": { template: '<div data-test="stats-table"></div>' },
  "v-select": {
    props: ["modelValue", "items", "label"],
    emits: ["update:modelValue"],
    template: `<select data-test="select" :aria-label="label" :value="modelValue"
      @change="$emit('update:modelValue', $event.target.value)">
      <option v-for="item in items" :key="item.id" :value="item.id">{{ item.label }}</option>
    </select>`,
  },
  "v-text-field": {
    props: ["modelValue", "label"],
    emits: ["update:modelValue"],
    template: `<input data-test="input" :aria-label="label" :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)" />`,
  },
  "v-icon": { template: "<i><slot /></i>" },
  "v-btn": {
    props: ["to", "disabled", "loading"],
    // Declared, so a click runs the page's handler once, not also as a
    // native listener.
    emits: ["click"],
    template:
      '<button data-test="action-btn" :disabled="disabled" :data-to="to && JSON.stringify(to)" @click="$emit(\'click\')"><slot /></button>',
  },
};

describe("route /dataset/:id/analyze/:variable", () => {
  beforeEach(() => {
    vi.stubGlobal("useRoute", () => ({ params: routeParams }));
    saveAs = vi.fn();
    imageExport
      .mockReset()
      .mockResolvedValue({ png: "data:image/png", svg: "data:image/svg+xml" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ blob: async () => new Blob(["image"]) })),
    );
    installNuxtTestGlobals({
      nuxtApp: {
        $download: {
          saveAs,
        },
      },
    });

    datasetStore = createDatasetStore({
      hasGeoJson: true,
      geoJson: { type: "FeatureCollection", features: [] },
    });
    analysisStore = createAnalysisStore();
    messagesStore = {
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      dismiss: vi.fn(),
    };
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

  it("[smoke] renders analysis form and timeseries plot", async () => {
    const wrapper = await mountWithSuspense(AnalyzePage, {
      global: { stubs: layoutStubs },
    });

    await flushPromises();
    const page = wrapper.findComponent(AnalyzePage);

    expect(page.find('[data-test="analysis-form"]').exists()).toBe(true);
    expect(page.findComponent({ name: "TimeSeriesPlotStub" }).exists()).toBe(
      true,
    );
  });

  it("[behavior] enables Download only after the current result and plot are ready", async () => {
    let finish!: (value: unknown) => void;
    extractionStore.resolveTimeSeries.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const wrapper = await mountWithSuspense(AnalyzePage, {
      global: { stubs: layoutStubs },
    });
    await flushPromises();
    const download = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Download"))!;
    expect(download.attributes("disabled")).toBeDefined();
    finish(timeSeriesResponseFixture);
    await flushPromises();
    expect(download.attributes("disabled")).toBeUndefined();
    const plot = wrapper.findComponent({ name: "TimeSeriesPlotStub" });
    plot.vm.$emit("plot-ready", false);
    await flushPromises();
    expect(download.attributes("disabled")).toBeDefined();
    plot.vm.$emit("plot-ready", true);
    extractionStore.resolveTimeSeries.mockRejectedValueOnce(
      new Error("failed"),
    );
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Update"))!
      .trigger("click");
    await flushPromises();
    expect(download.attributes("disabled")).toBeDefined();
    expect(saveAs).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("[behavior] finishes a precise, consistent archive after the active selection changes", async () => {
    const result = JSON.parse(JSON.stringify(timeSeriesResponseFixture));
    result.summary_stats = [
      {
        name: "Original",
        mean: 1.23456789012345,
        median: null,
        stdev: 0.000000123,
      },
    ];
    result.series[0].values = [1.23456789012345, null, 3];
    extractionStore.resolveTimeSeries.mockResolvedValueOnce(result);
    const wrapper = await mountWithSuspense(AnalyzePage, {
      global: { stubs: layoutStubs },
    });
    await flushPromises();
    analysisStore.summaryStatistics = [
      { name: "Original", mean: "1.23", median: "null", stdev: "0.00" },
    ];
    const expectedRequest = JSON.parse(
      JSON.stringify(analysisStore.completedRequest),
    );
    let finishImages!: (images: unknown) => void;
    imageExport.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishImages = resolve;
        }),
    );
    const download = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Download"))!;
    await download.trigger("click");
    expect(download.attributes("disabled")).toBeDefined();
    await download.trigger("click");
    expect(imageExport).toHaveBeenCalledTimes(1);
    datasetStore.geoJson = { type: "Point", coordinates: [0, 0] };
    analysisStore.requestData = { ...expectedRequest, dataset_id: "other" };
    analysisStore.response = { ...result, summary_stats: [] };
    wrapper.unmount();
    finishImages({ png: "data:image/png", svg: "data:image/svg+xml" });
    await vi.waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
    const [blob, filename] = saveAs.mock.calls[0]!;
    expect(filename).toBe("paleocar_tasmax.zip");
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
    const zip = await JSZip.loadAsync(bytes);
    expect(
      JSON.parse(await zip.file("skope-request.json")!.async("string")),
    ).toEqual(expectedRequest);
    expect(
      JSON.parse(await zip.file("study-area.geojson")!.async("string")),
    ).toEqual(expectedRequest.selected_area);
    expect(
      JSON.parse(await zip.file("summary-statistics.json")!.async("string")),
    ).toEqual(result.summary_stats);
    expect(
      JSON.parse(await zip.file("time-series.json")!.async("string"))[0].y,
    ).toEqual([1.23456789012345, null, 3]);
    expect(await zip.file("time-series.csv")!.async("string")).toContain(
      "1.23456789012345",
    );
    expect(await zip.file("plot.png")!.async("string")).toBe("image");
    expect(await zip.file("plot.svg")!.async("string")).toBe("image");
    expect(await zip.file("README.md")!.async("string")).toContain(
      "paleocar / tasmax",
    );
  });

  it("[behavior] reports export failures and allows retrying", async () => {
    const wrapper = await mountWithSuspense(AnalyzePage, {
      global: { stubs: layoutStubs },
    });
    await flushPromises();
    imageExport.mockRejectedValueOnce(new Error("image failed"));
    const download = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Download"))!;
    await download.trigger("click");
    await flushPromises();
    expect(messagesStore.error).toHaveBeenCalledWith(
      "Unable to prepare the download. Please try again.",
    );
    expect(saveAs).not.toHaveBeenCalled();
    expect(download.attributes("disabled")).toBeUndefined();
    wrapper.unmount();
  });

  it("[behavior] submits updated request data when Update is clicked", async () => {
    const wrapper = await mountWithSuspense(AnalyzePage, {
      global: { stubs: layoutStubs },
    });
    const page = wrapper.findComponent(AnalyzePage);

    await flushPromises();
    // The first analysis runs on mount; Update must run another.
    expect(extractionStore.resolveTimeSeries).toHaveBeenCalledTimes(1);

    const updateButton = page
      .findAll('[data-test="action-btn"]')
      .find((button) => button.text().includes("Update"));

    expect(updateButton).toBeDefined();
    await updateButton!.trigger("click");
    await flushPromises();

    expect(analysisStore.setRequestData).toHaveBeenCalledTimes(1);
    const [request] = analysisStore.setRequestData.mock.calls[0];
    expect(request).toMatchObject({
      zonal_statistic: "mean",
      time_range: { gte: "0001-01-01", lte: "0003-01-01" },
    });
    expect(extractionStore.resolveTimeSeries).toHaveBeenCalledTimes(2);
    expect(extractionStore.resolveTimeSeries).toHaveBeenLastCalledWith(request);
  });

  it("[behavior] restores unsubmitted analysis edits after leaving and returning", async () => {
    const mountPage = () =>
      mountWithSuspense(AnalyzePage, { global: { stubs: layoutStubs } });
    const first = await mountPage();
    await flushPromises();
    await first
      .find('[aria-label="Select a smoothing option"]')
      .setValue("centeredAverage");
    await first.find('[aria-label="Smoothing window"]').setValue("19");
    await first
      .find('[aria-label="Select a transformation option"]')
      .setValue("zscoreMoving");
    await first.find('[aria-label="Transform window"]').setValue("37");
    expect(analysisStore.setRequestData).not.toHaveBeenCalled();
    first.unmount();
    expect(analysisStore.formDrafts["paleocar:tasmax"].smoothingOption).toBe(
      "centeredAverage",
    );

    const second = await mountPage();
    await flushPromises();
    expect(
      (
        second.find('[aria-label="Select a smoothing option"]')
          .element as HTMLSelectElement
      ).value,
    ).toBe("centeredAverage");
    expect(
      (
        second.find('[aria-label="Smoothing window"]')
          .element as HTMLInputElement
      ).value,
    ).toBe("19");
    expect(
      (
        second.find('[aria-label="Transform window"]')
          .element as HTMLInputElement
      ).value,
    ).toBe("37");
    expect(analysisStore.setRequestData).not.toHaveBeenCalled();
    second.unmount();
  });

  it("[behavior] shows the API's reason for a 422 as a warning", async () => {
    const reason =
      "The z-score's reference period [0450, 0500] has 0 time steps with values; it needs at least 2. Choose other years.";
    extractionStore.resolveTimeSeries.mockRejectedValueOnce(
      Object.assign(new Error("Request failed with status 422"), {
        response: { status: 422, data: { detail: reason } },
      }),
    );

    await mountWithSuspense(AnalyzePage, { global: { stubs: layoutStubs } });
    await flushPromises();

    expect(messagesStore.warning).toHaveBeenCalledWith(reason);
    expect(messagesStore.error).not.toHaveBeenCalled();
  });

  it("[behavior] retains the displayed transform label after a later request fails", async () => {
    const wrapper = await mountWithSuspense(AnalyzePage, {
      global: { stubs: layoutStubs },
    });
    const select = wrapper.find(
      '[aria-label="Select a transformation option"]',
    );
    const update = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Update"))!;
    extractionStore.resolveTimeSeries.mockResolvedValueOnce({
      ...timeSeriesResponseFixture,
      transform: { type: "ZScoreMovingInterval", width: 2 },
    });
    await select.setValue("zscoreMoving");
    await wrapper.find('[aria-label="Transform window"]').setValue("2");
    await update.trigger("click");
    await flushPromises();
    const plot = wrapper.findComponent({ name: "TimeSeriesPlotStub" });
    expect(plot.props("yAxisLabel")).toBe("Z-Score wrt moving interval");
    const traces = plot.props("traces");
    extractionStore.resolveTimeSeries.mockRejectedValueOnce(
      new Error("offline"),
    );
    await select.setValue("none");
    await update.trigger("click");
    await flushPromises();
    expect(plot.props("traces")).toEqual(traces);
    expect(plot.props("yAxisLabel")).toBe("Z-Score wrt moving interval");
    wrapper.unmount();
  });

  it("[behavior] ignores an obsolete request's label when Clear finishes first", async () => {
    let sequence = 0;
    extractionStore.beginRequest = () => {
      const token = ++sequence;
      return () => token === sequence;
    };
    const wrapper = await mountWithSuspense(AnalyzePage, {
      global: { stubs: layoutStubs },
    });
    let finish!: (value: unknown) => void;
    extractionStore.resolveTimeSeries.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await wrapper
      .find('[aria-label="Select a transformation option"]')
      .setValue("zscoreMoving");
    await wrapper.find('[aria-label="Transform window"]').setValue("2");
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Update"))!
      .trigger("click");
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Clear")!
      .trigger("click");
    await flushPromises();
    const plot = wrapper.findComponent({ name: "TimeSeriesPlotStub" });
    expect(plot.props("yAxisLabel")).toBe("");
    finish({
      ...timeSeriesResponseFixture,
      transform: { type: "ZScoreMovingInterval", width: 2 },
    });
    await flushPromises();
    expect(plot.props("yAxisLabel")).toBe("");
    expect(analysisStore.response.transform).toEqual({ type: "NoTransform" });
    wrapper.unmount();
  });

  it("[behavior] can recover from a failed metadata load", async () => {
    const metadata = datasetStore.metadata;
    datasetStore.metadata = null;
    metadataActions.initializeDataset.mockRejectedValueOnce(
      new Error("offline"),
    );
    const wrapper = await mountWithSuspense(AnalyzePage, {
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
    expect(wrapper.find('[data-test="analysis-form"]').exists()).toBe(true);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("[behavior] starts the analysis once metadata arrives after mounting", async () => {
    // A fresh page load: the page mounts before the dataset's metadata loads.
    const metadata = datasetStore.metadata;
    datasetStore.metadata = null;

    await mountWithSuspense(AnalyzePage, { global: { stubs: layoutStubs } });
    await flushPromises();
    expect(analysisStore.setDefaultRequestData).not.toHaveBeenCalled();
    expect(extractionStore.resolveTimeSeries).not.toHaveBeenCalled();

    datasetStore.metadata = metadata;
    await flushPromises();

    expect(studyArea.restore).toHaveBeenCalled();
    expect(analysisStore.setDefaultRequestData).toHaveBeenCalledTimes(1);
    expect(extractionStore.resolveTimeSeries).toHaveBeenCalledTimes(1);
    expect(datasetStore.setAreaSummary).toHaveBeenCalledWith(
      timeSeriesResponseFixture.n_cells,
      timeSeriesResponseFixture.area,
    );
  });
});
