import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TimeSeriesPlot from "@/components/dataset/TimeSeriesPlot.vue";
import { useDatasetStore } from "@/stores/dataset";
import metadataFixture from "@/tests/fixtures/metadata-1.0.0.json";

vi.mock("@/components/dataset/PlotlyClient.vue", () => ({
  __esModule: true,
  default: {
    name: "PlotlyStub",
    props: ["data", "layout", "options", "shapes"],
    template: "<div />",
  },
}));

const passThrough = { template: "<div><slot /></div>" };
const validateRange = vi.fn(async () => ({ valid: true }));

function mountPlot(props: Record<string, unknown> = {}) {
  return mount(TimeSeriesPlot, {
    props: { traces: [], ...props },
    global: {
      stubs: {
        "client-only": passThrough,
        "v-card": passThrough,
        "v-card-text": passThrough,
        "v-form": {
          template: "<form><slot /></form>",
          methods: { validate: () => validateRange() },
        },
        "v-text-field": {
          inheritAttrs: false,
          props: ["modelValue", "error", "errorMessages"],
          emits: ["update:modelValue"],
          template: `<div>
            <input v-bind="$attrs" :value="modelValue" :aria-invalid="!!error"
              @input="$emit('update:modelValue', $event.target.value)" />
            <template v-for="message in errorMessages || []" :key="message">
              <slot name="message" :message="message" />
            </template>
          </div>`,
        },
        "v-btn": { template: "<button><slot /></button>" },
        "v-icon": true,
        "v-tooltip": true,
        "v-alert": true,
        "v-progress-circular": true,
      },
    },
  });
}

describe("TimeSeriesPlot loading messages", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the progress messages on the first request too", async () => {
    // The store starts out loading, so the first request doesn't change the
    // status string.
    const store = useDatasetStore();
    const wrapper = mountPlot();
    store.setTimeSeriesLoading();
    await flushPromises();

    vi.advanceTimersByTime(8_000);
    await flushPromises();
    expect(wrapper.find(".loading-message").text()).toBe("Still working...");

    vi.advanceTimersByTime(8_000);
    await flushPromises();
    expect(wrapper.find(".loading-message").text()).toBe(
      "Hang tight, almost there...",
    );
  });

  it("stops the messages once the data arrives", async () => {
    const store = useDatasetStore();
    const wrapper = mountPlot();
    store.setTimeSeriesLoaded();
    await flushPromises();

    vi.advanceTimersByTime(30_000);
    await flushPromises();
    expect(wrapper.find(".loading-message").exists()).toBe(false);
  });
});

describe("TimeSeriesPlot range submission", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    validateRange.mockReset().mockResolvedValue({ valid: true });
    const store = useDatasetStore();
    store.setMetadata(metadataFixture.datasets[0] as any);
    store.setTemporalRange([1500, 1800]);
  });

  it("validates an invalid draft on Enter without applying it", async () => {
    const store = useDatasetStore();
    validateRange.mockResolvedValueOnce({ valid: false });
    const wrapper = mountPlot();
    const from = wrapper.find(".time-series-range input");
    await from.setValue("1");
    await from.trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect(validateRange).toHaveBeenCalledOnce();
    expect(store.temporalRange).toEqual([1500, 1800]);
    expect(wrapper.emitted("selected-temporal-range")).toBeUndefined();
    wrapper.unmount();
  });

  it("starts editable and keeps changes local until Apply", async () => {
    const store = useDatasetStore();
    const wrapper = mountPlot();
    const from = wrapper.find(".time-series-range input");
    expect(from.attributes("disabled")).toBeUndefined();
    await from.setValue("1600");
    expect(store.temporalRange).toEqual([1500, 1800]);
    expect(wrapper.emitted("selected-temporal-range")).toBeUndefined();
    // Vuetify updates form validity after validating the fields.
    wrapper
      .findComponent({ ref: "temporalRangeForm" })
      .vm.$emit("update:modelValue", true);
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Apply")!
      .trigger("click");
    await flushPromises();
    expect(store.temporalRange).toEqual([1600, 1800]);
    store.setTemporalRange([1700, 1900]);
    await flushPromises();
    expect((from.element as HTMLInputElement).value).toBe("1700");
    wrapper.unmount();
  });

  it("keeps an unsubmitted time range when moving between steps", async () => {
    const first = mountPlot();
    await first.find(".time-series-range input").setValue("1600");
    first.unmount();
    const second = mountPlot();
    await flushPromises();
    expect(
      (second.find(".time-series-range input").element as HTMLInputElement)
        .value,
    ).toBe("1600");
    expect(useDatasetStore().temporalRange).toEqual([1500, 1800]);
    second.unmount();
  });

  it("applies a valid draft on Enter without requiring blur first", async () => {
    const store = useDatasetStore();
    const wrapper = mountPlot();
    const from = wrapper.find(".time-series-range input");
    await from.setValue("1600");
    await from.trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect(validateRange).toHaveBeenCalledOnce();
    expect(store.temporalRange).toEqual([1600, 1800]);
    expect(wrapper.emitted("selected-temporal-range")).toEqual([
      [[1600, 1800]],
    ]);
    wrapper.unmount();
  });
});

describe("TimeSeriesPlot step controls", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("shows the current timestep in the header, outside the range form", async () => {
    const wrapper = mountPlot({ showStepControls: true, stepSelected: 1500 });
    await flushPromises();
    const field = wrapper.find('[data-test="current-step"]');
    expect((field.element as HTMLInputElement).value).toBe("1500");
    expect(field.element.closest(".panel-header")).not.toBeNull();
    expect(field.element.closest(".time-series-range")).toBeNull();
    expect(wrapper.find(".time-series-step-controls input").exists()).toBe(
      false,
    );
  });

  it("pauses playback when editing the current year", async () => {
    const wrapper = mountPlot({ showStepControls: true, stepSelected: 1500 });
    await flushPromises();
    await wrapper.find('[data-test="current-step"]').trigger("focus");
    expect(wrapper.emitted("pause-playback")).toHaveLength(1);
  });
});

describe("TimeSeriesPlot typed timestep", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const store = useDatasetStore();
    store.setMetadata({
      ...metadataFixture.datasets[0],
      time: {
        ...metadataFixture.datasets[0]!.time,
        origin: "1001",
        end: "2000",
      },
    } as any);
    store.setTemporalRange([1500, 1600]);
  });

  async function typeStep(text: string) {
    const wrapper = mountPlot({ showStepControls: true, stepSelected: 1550 });
    await flushPromises();
    const field = wrapper.find('[data-test="current-step"]');
    await field.setValue(text);
    return { wrapper, field };
  }

  it("selects a typed timestep on Enter", async () => {
    const { wrapper, field } = await typeStep("1575");
    await field.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("step-selected")).toEqual([[1575]]);
  });

  it("rejects a timestep outside the range and says which are allowed", async () => {
    const { wrapper, field } = await typeStep("1700");
    await field.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("step-selected")).toBeUndefined();
    expect(field.attributes("aria-invalid")).toBe("true");
    expect((field.element as HTMLInputElement).value).toBe("1700");
    expect(wrapper.find('[data-test="step-message"]').text()).toBe(
      "Use 1500–1600.",
    );
  });

  it("puts the current timestep back when left with a rejected one", async () => {
    vi.useFakeTimers();
    const { wrapper, field } = await typeStep("abc");
    await field.trigger("blur");
    expect((field.element as HTMLInputElement).value).toBe("1550");
    expect(wrapper.find('[data-test="step-message"]').exists()).toBe(true);
    vi.advanceTimersByTime(4_000);
    await flushPromises();
    expect(wrapper.find('[data-test="step-message"]').exists()).toBe(false);
    vi.useRealTimers();
  });

  it("puts the current timestep back on Escape", async () => {
    const { wrapper, field } = await typeStep("1575");
    await field.trigger("keydown", { key: "Escape" });
    expect((field.element as HTMLInputElement).value).toBe("1550");
    expect(wrapper.emitted("step-selected")).toBeUndefined();
  });
});

describe("TimeSeriesPlot timeline bounds", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useDatasetStore().setMetadata(metadataFixture.datasets[0] as any);
  });

  it("uses the new range while old data and the previous map year are still displayed", async () => {
    const store = useDatasetStore();
    const wrapper = mountPlot({
      stepSelected: 103,
      traces: [{ x: [103, 900, 1100, 2000], y: [1, 2, 3, 4] }],
    });
    await flushPromises();
    const layout = () =>
      wrapper.findComponent({ name: "PlotlyStub" }).props("layout");

    store.setTemporalRange([900, 1100]);
    await flushPromises();
    expect(layout().xaxis.range).toEqual([900, 1100]);
    expect(layout().xaxis.autorange).toBe(false);
    expect(
      wrapper.findComponent({ name: "PlotlyStub" }).props("shapes"),
    ).toEqual([]);
    const previousLayout = layout();

    await wrapper.setProps({ stepSelected: 900 });
    expect(layout().xaxis.range).toEqual([900, 1100]);
    expect(
      wrapper.findComponent({ name: "PlotlyStub" }).props("shapes")[0],
    ).toMatchObject({ x0: 900, x1: 900 });
    expect(layout()).toBe(previousLayout);
    wrapper.unmount();
  });

  it("preserves the zoom revision during playback and changes it for a new range", async () => {
    const store = useDatasetStore();
    store.setTemporalRange([900, 1100]);
    const wrapper = mountPlot({ stepSelected: 900 });
    await flushPromises();
    const layout = () =>
      wrapper.findComponent({ name: "PlotlyStub" }).props("layout");
    const revision = layout().xaxis.uirevision;

    await wrapper.setProps({ stepSelected: 901 });
    expect(layout().xaxis.uirevision).toBe(revision);
    store.setTemporalRange([1000, 1050]);
    await flushPromises();
    expect(layout().xaxis.range).toEqual([1000, 1050]);
    expect(layout().xaxis.uirevision).not.toBe(revision);
    wrapper.unmount();
  });
});

describe("TimeSeriesPlot axis labels", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("labels an annual axis Year and uses Time for unsupported precisions", async () => {
    const store = useDatasetStore();
    store.setMetadata(metadataFixture.datasets[0] as any);
    const wrapper = mountPlot({ showStepControls: true, stepSelected: 1500 });
    await flushPromises();
    const layout = () =>
      wrapper.findComponent({ name: "PlotlyStub" }).props("layout");
    expect(layout().xaxis.title.text).toBe("Year");
    expect(
      wrapper.find('[data-test="current-step"]').attributes("aria-label"),
    ).toBe("Current year");
    store.metadata!.time.precision = "month";
    await flushPromises();
    expect(layout().xaxis.title.text).toBe("Time");
    expect(
      wrapper.find('[data-test="current-step"]').attributes("aria-label"),
    ).toBe("Current time");
  });

  async function layoutFor(title: string, unit: string) {
    const store = useDatasetStore();
    store.setMetadata({
      ...metadataFixture.datasets[0],
      default_variable: "v",
      variables: [
        { ...metadataFixture.datasets[0]!.variables[0]!, id: "v", title, unit },
      ],
    } as any);
    const wrapper = mountPlot();
    await flushPromises();
    return wrapper.findComponent({ name: "PlotlyStub" }).props("layout");
  }

  it("keeps the plot's left edge put for short and long titles", async () => {
    const short = await layoutFor("Annual (Jan–Dec) Precipitation", "mm");
    const long = await layoutFor(
      "Water-year (Oct–Sept) Cotton Growing Degree Days",
      "°C GDD",
    );
    expect(short.margin.l).toBe(long.margin.l);
    expect(short.yaxis.automargin).toBeFalsy();
    expect(short.annotations[0].text).toBe(
      "Annual (Jan–Dec) Precipitation (mm)",
    );
    expect(long.annotations[0].text).toBe(
      "Water-year (Oct–Sept) Cotton<br>Growing Degree Days (°C GDD)",
    );
  });
});

it("exports through the registered public API and rejects once it is removed", async () => {
  setActivePinia(createPinia());
  const wrapper = mountPlot();
  await flushPromises();
  const child = wrapper.findComponent({ name: "PlotlyStub" });
  const traces = [{ name: "Original", x: [1], y: [2] }];
  const toImages = vi.fn().mockResolvedValue({ svg: "svg", png: "png" });
  child.vm.$emit("api-ready", { toImages });
  await expect(wrapper.vm.getTimeSeriesPlotImage(traces)).resolves.toEqual({
    svg: "svg",
    png: "png",
  });
  expect(toImages).toHaveBeenCalledWith(traces);
  child.vm.$emit("api-ready", null);
  await expect(wrapper.vm.getTimeSeriesPlotImage(traces)).rejects.toThrow(
    "not ready",
  );
  wrapper.unmount();
});
