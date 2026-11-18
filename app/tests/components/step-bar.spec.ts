import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StepBar from "@/components/StepBar.vue";
import metadataFixture from "@/tests/fixtures/metadata-1.0.0.json";
import { useDatasetStore } from "@/stores/dataset";

const route = vi.hoisted(() => ({
  name: "dataset-id",
  params: {} as Record<string, string>,
}));

vi.mock("vue-router", () => ({ useRoute: () => route }));

const VBtnStub = {
  props: ["to", "disabled", "variant"],
  template:
    '<button :disabled="disabled" :data-variant="variant" :data-to="to && JSON.stringify(to)"><slot name="prepend" /><slot /></button>',
};

function mountBar() {
  return mount(StepBar, {
    global: { stubs: { "v-btn": VBtnStub, "v-icon": true } },
  });
}

function stepState(wrapper: ReturnType<typeof mountBar>) {
  return wrapper.findAll('[data-test="workflow-step"]').map((step) => ({
    label: step.text(),
    current: step.attributes("data-variant") === "tonal",
    disabled: step.attributes("disabled") !== undefined,
    complete: step.find('[data-test="step-complete"]').exists(),
  }));
}

describe("StepBar", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    route.params = { id: "paleocar_v3" };
  });

  it("[behavior] keeps later steps out of reach until there's a study area", async () => {
    route.name = "dataset-id";
    const wrapper = mountBar();
    await flushPromises();

    expect(stepState(wrapper)).toEqual([
      {
        label: "Select Dataset",
        current: false,
        disabled: false,
        complete: true,
      },
      { label: "Select Area", current: true, disabled: false, complete: false },
      { label: "Visualize", current: false, disabled: true, complete: false },
      { label: "Analyze", current: false, disabled: true, complete: false },
    ]);
  });

  it("[behavior] marks earlier steps done and links to every step on visualize", async () => {
    route.name = "dataset-id-visualize-variable";
    route.params = { id: "paleocar_v3", variable: "ppt_annual" };
    const datasetStore = useDatasetStore();
    datasetStore.setMetadata(metadataFixture.datasets[0] as any);
    datasetStore.setVariable("ppt_annual");
    datasetStore.setGeoJson({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [-108.5, 37] },
    });
    const wrapper = mountBar();
    await flushPromises();

    const state = stepState(wrapper);
    expect(state.map((s) => s.complete)).toEqual([true, true, false, false]);
    expect(state.map((s) => s.current)).toEqual([false, false, true, false]);
    expect(state.every((s) => !s.disabled)).toBe(true);
    const analyze = wrapper.findAll('[data-test="workflow-step"]')[3]!;
    expect(JSON.parse(analyze.attributes("data-to")!)).toMatchObject({
      name: "dataset-id-analyze-variable",
    });
  });

  it("[behavior] offers no link to visualize until the variable is known", async () => {
    // A link without its variable makes the router throw mid-render, which
    // left every page blank.
    route.name = "dataset-id";
    const datasetStore = useDatasetStore();
    datasetStore.setGeoJson({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [-108.5, 37] },
    });
    const wrapper = mountBar();
    await flushPromises();

    const items = wrapper.findAll('[data-test="workflow-step"]');
    const visualize = items[2]!;
    const analyze = items[3]!;
    expect(visualize.attributes("data-to")).toBeUndefined();
    expect(visualize.attributes("disabled")).toBeDefined();
    expect(analyze.attributes("disabled")).toBeDefined();
  });
});
