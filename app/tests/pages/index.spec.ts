import { reactive, nextTick } from "vue";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDatasetStore,
  datasetMetadataFixture,
} from "@/tests/fixtures/page-fixtures";
import {
  installNuxtTestGlobals,
  mountWithSuspense,
  resetNuxtTestGlobals,
} from "@/tests/fixtures/nuxt-test-helpers";

import IndexPage from "@/pages/index.vue";

let datasetStore: any;
let metadataStore: any;
let metadataActions: any;

vi.mock("@/components/dataset/Search.vue", () => ({
  default: {
    name: "SearchStub",
    template: '<div data-test="search">search</div>',
  },
}));

vi.mock("@/components/dataset/ListItem.vue", () => ({
  default: {
    name: "ListItemStub",
    props: ["dataset"],
    template: '<div data-test="dataset-item">{{ dataset.title }}</div>',
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

vi.mock("@/stores/metadata", () => ({
  useMetadataStore: () => metadataStore,
}));

vi.mock("@/composables/useDatasetMetadata", () => ({
  useDatasetMetadata: () => metadataActions,
}));

const layoutStubs = {
  "v-container": { template: "<div><slot /></div>" },
  "v-row": { template: "<div><slot /></div>" },
  "v-col": { template: "<div><slot /></div>" },
  "v-tooltip": {
    template: '<div><slot name="activator" :props="{}" /><slot /></div>',
  },
  "v-btn": { template: "<button><slot /></button>" },
  "v-icon": { template: "<i><slot /></i>" },
  "v-card": { template: "<div><slot /></div>" },
  "v-alert": { template: "<div><slot /></div>" },
};

describe("route /", () => {
  beforeEach(() => {
    installNuxtTestGlobals();

    datasetStore = createDatasetStore();
    metadataStore = reactive({
      filteredDatasets: [datasetMetadataFixture],
    });
    metadataActions = {
      loadAllDatasetMetadata: vi.fn(async () => true),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetNuxtTestGlobals();
  });

  it("[smoke] renders page header and dataset list", async () => {
    const wrapper = await mountWithSuspense(IndexPage, {
      global: { stubs: layoutStubs },
    });

    await nextTick();
    const page = wrapper.findComponent(IndexPage);

    expect(page.exists()).toBe(true);
    expect(page.text()).toContain("Select a Dataset");
    expect(page.text()).toContain("PaleoCAR");
    expect(metadataActions.loadAllDatasetMetadata).toHaveBeenCalledTimes(1);
  });

  it("[behavior] retains each dataset card's identity when the catalog order changes", async () => {
    const other = {
      ...datasetMetadataFixture,
      id: "other",
      title: "Other dataset",
    };
    metadataStore.filteredDatasets = [datasetMetadataFixture, other];
    const wrapper = await mountWithSuspense(IndexPage, {
      global: { stubs: layoutStubs },
    });
    const first = wrapper.findAllComponents({ name: "ListItemStub" })[0]!.vm;
    metadataStore.filteredDatasets = [other, datasetMetadataFixture];
    await nextTick();
    expect(wrapper.findAllComponents({ name: "ListItemStub" })[1]!.vm).toBe(
      first,
    );
    wrapper.unmount();
  });

  it("[behavior] shows empty state when filter removes all datasets", async () => {
    const wrapper = await mountWithSuspense(IndexPage, {
      global: { stubs: layoutStubs },
    });

    metadataStore.filteredDatasets = [];
    await nextTick();
    const page = wrapper.findComponent(IndexPage);

    expect(page.text()).toContain("No datasets found");
  });

  it("[behavior] shows a spinner, not the empty state, while the datasets load", async () => {
    // As on a first page load: the page renders before the request answers.
    let finish: () => void = () => undefined;
    metadataActions.loadAllDatasetMetadata = vi.fn(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    vi.stubGlobal(
      "useAsyncData",
      vi.fn((_key: unknown, handler: () => unknown) => {
        handler();
        return { data: { value: null }, error: { value: null } };
      }),
    );
    metadataStore.filteredDatasets = [];

    const wrapper = await mountWithSuspense(IndexPage, {
      global: { stubs: layoutStubs },
    });
    const page = wrapper.findComponent(IndexPage);

    expect(page.find('[data-test="loading"]').exists()).toBe(true);
    expect(page.text()).not.toContain("No datasets found");

    finish();
    await flushPromises();

    expect(page.find('[data-test="loading"]').exists()).toBe(false);
    expect(page.text()).toContain("No datasets found");
  });

  it("[behavior] says the datasets failed to load instead of none found", async () => {
    metadataActions.loadAllDatasetMetadata = vi.fn(async () => {
      throw new Error("Request failed with status 500");
    });
    metadataStore.filteredDatasets = [];

    const wrapper = await mountWithSuspense(IndexPage, {
      global: { stubs: layoutStubs },
    });
    await nextTick();
    const page = wrapper.findComponent(IndexPage);

    expect(page.text()).toContain("Unable to load the datasets");
    expect(page.text()).not.toContain("No datasets found");
  });
});
