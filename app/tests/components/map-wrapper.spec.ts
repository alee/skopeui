import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import Map from "@/components/dataset/Map.client.vue";

vi.mock("@/components/dataset/MapLibre.client.vue", () => ({
  default: {
    name: "MapLibreStub",
    props: ["step", "preloadStep", "displayRaster"],
    emits: ["mapReady", "stepReady", "stepError"],
    template: '<div data-test="maplibre"><slot name="footer" /></div>',
  },
}));

describe("Map wrapper", () => {
  it("renders MapLibre with the supplied raster settings", () => {
    const wrapper = mount(Map, {
      props: { step: 590, preloadStep: 591, displayRaster: false },
    });
    expect(
      wrapper.findComponent({ name: "MapLibreStub" }).props(),
    ).toMatchObject({ step: 590, preloadStep: 591, displayRaster: false });
  });
  it("preserves defaults, readiness events and the footer slot", () => {
    const wrapper = mount(Map, {
      slots: { footer: '<span data-test="footer">Playback</span>' },
    });
    const child = wrapper.findComponent({ name: "MapLibreStub" });
    expect(child.props()).toMatchObject({ step: 2000, displayRaster: true });
    child.vm.$emit("mapReady", true);
    child.vm.$emit("stepReady", 103);
    child.vm.$emit("stepError", 104);
    expect(wrapper.emitted("mapReady")).toEqual([[true]]);
    expect(wrapper.emitted("stepReady")).toEqual([[103]]);
    expect(wrapper.emitted("stepError")).toEqual([[104]]);
    expect(wrapper.find('[data-test="footer"]').text()).toBe("Playback");
  });
});
