import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SubHeader from "@/components/dataset/SubHeader.vue";
import { useDatasetStore } from "@/stores/dataset";
import metadata from "@/tests/fixtures/metadata-1.0.0.json";
import type { Dataset } from "@/types/metadata";

const push = vi.fn();
beforeEach(() => {
  setActivePinia(createPinia());
  push.mockReset();
  vi.stubGlobal("useRouter", () => ({ push }));
  vi.stubGlobal("useRoute", () => ({
    name: "dataset-id-analyze-variable",
    params: { id: "paleocar_v3" },
  }));
});
afterEach(() => vi.unstubAllGlobals());

it("binds the selected variable ID and updates the store and current workflow route", async () => {
  const dataset = useDatasetStore();
  dataset.setMetadata(metadata.datasets[0] as Dataset);
  const wrapper = mount(SubHeader, {
    props: { selectVariable: true },
    global: {
      stubs: {
        "v-row": { template: "<div><slot /></div>" },
        "v-col": { template: "<div><slot /></div>" },
        "v-btn": true,
        "v-icon": true,
        "v-tooltip": true,
        MetadataModal: true,
        "v-select": {
          name: "VariableSelectStub",
          props: ["modelValue"],
          emits: ["update:modelValue"],
          template: "<select />",
        },
      },
    },
  });
  const select = wrapper.findComponent({ name: "VariableSelectStub" });
  expect(select.props("modelValue")).toBe(dataset.variable.id);
  select.vm.$emit("update:modelValue", "ppt_annual");
  await flushPromises();
  expect(dataset.variableId).toBe("ppt_annual");
  expect(push).toHaveBeenCalledWith({
    name: "dataset-id-analyze-variable",
    params: { id: "paleocar_v3", variable: "ppt_annual" },
  });
  wrapper.unmount();
});
