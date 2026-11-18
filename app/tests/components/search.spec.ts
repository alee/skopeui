import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import Search from "@/components/dataset/Search.vue";
import { useMetadataStore } from "@/stores/metadata";

const passThrough = { template: "<div><slot /></div>" };
const field = {
  props: ["modelValue", "label"],
  emits: ["update:modelValue"],
  template:
    '<input :aria-label="label" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
};
const categoryField = { ...field, name: "CategoryStub" };
function mountSearch() {
  return mount(Search, {
    global: {
      stubs: {
        "v-form": passThrough,
        "v-row": passThrough,
        "v-col": passThrough,
        "v-text-field": field,
        "v-combobox": categoryField,
      },
    },
  });
}
beforeEach(() => setActivePinia(createPinia()));

describe("catalog search", () => {
  it("keeps the visible controls aligned with filters across remounts", async () => {
    const store = useMetadataStore();
    const first = mountSearch();
    await first.get('[aria-label="Keyword search"]').setValue("drought");
    await first.get('[aria-label="Start Year"]').setValue("1500");
    store.filterCriteria.selectedCategories = ["Drought"];
    first.unmount();
    const second = mountSearch();
    expect(
      (second.get('[aria-label="Keyword search"]').element as HTMLInputElement)
        .value,
    ).toBe("drought");
    expect(
      (second.get('[aria-label="Start Year"]').element as HTMLInputElement)
        .value,
    ).toBe("1500");
    expect(
      second.getComponent({ name: "CategoryStub" }).props("modelValue"),
    ).toEqual(["Drought"]);
    second.unmount();
  });

  it("normalizes the clearable query without keeping a second copy", async () => {
    const store = useMetadataStore();
    store.filterCriteria.query = "drought";
    const wrapper = mountSearch();
    const query = wrapper
      .findAllComponents(field)
      .find((component) => component.props("label") === "Keyword search")!;
    query.vm.$emit("update:modelValue", null);
    expect(store.filterCriteria.query).toBe("");
    wrapper.unmount();
  });
});
