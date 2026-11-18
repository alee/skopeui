import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PlotlyClient from "@/components/dataset/PlotlyClient.vue";

const plotly = vi.hoisted(() => ({
  react: vi.fn(),
  toImage: vi.fn(),
  purge: vi.fn(),
  register: vi.fn(),
  Plots: { resize: vi.fn() },
}));
vi.mock("plotly.js/lib/core", () => ({ default: plotly }));
vi.mock("plotly.js/lib/scatter", () => ({ default: {} }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  plotly.react.mockImplementation(async (target, data, layout) => {
    target.data = JSON.parse(JSON.stringify(data));
    target.layout = JSON.parse(JSON.stringify(layout));
    target.on = vi.fn();
  });
});
afterEach(() => vi.unstubAllGlobals());

it("exports both images from the captured zoom and data, even after updating and unmounting", async () => {
  const wrapper = mount(PlotlyClient, {
    props: {
      data: [{ x: [1, 2, 3], y: [10, 20, 30], name: "Original" }],
      layout: { xaxis: { range: [1, 3] } },
    },
  });
  await flushPromises();
  const target = wrapper.element as any;
  target.layout.xaxis.range = [1.5, 2.5]; // User zoom, distinct from the selected interval.
  let finishSvg!: (value: string) => void;
  plotly.toImage
    .mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finishSvg = resolve;
        }),
    )
    .mockResolvedValueOnce("data:image/png");
  const pending = (wrapper.vm as any).toImages();
  target.layout.xaxis.range = [100, 200];
  target.data[0].y[0] = 999;
  wrapper.unmount();
  finishSvg("data:image/svg+xml");
  await expect(pending).resolves.toEqual({
    svg: "data:image/svg+xml",
    png: "data:image/png",
  });
  for (const [figure] of plotly.toImage.mock.calls) {
    expect(figure.layout.xaxis.range).toEqual([1.5, 2.5]);
    expect(figure.data[0].y).toEqual([10, 20, 30]);
  }
});

it("does not export the previous figure while a new render is pending", async () => {
  const wrapper = mount(PlotlyClient, { props: { data: [] } });
  await flushPromises();
  expect(wrapper.emitted("ready")?.at(-1)).toEqual([true]);
  let finishRender!: () => void;
  plotly.react.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishRender = resolve;
      }),
  );
  await wrapper.setProps({ data: [{ x: [1], y: [2] }] });
  await flushPromises();
  expect(wrapper.emitted("ready")?.at(-1)).toEqual([false]);
  await expect((wrapper.vm as any).toImages()).rejects.toThrow("not ready");
  expect(plotly.toImage).not.toHaveBeenCalled();
  finishRender();
  await flushPromises();
  expect(wrapper.emitted("ready")?.at(-1)).toEqual([true]);
  wrapper.unmount();
});

it("rejects a rendered plot whose data does not match the captured analysis", async () => {
  const wrapper = mount(PlotlyClient, {
    props: { data: [{ name: "Original", x: [1], y: [2] }] },
  });
  await flushPromises();
  await expect(
    (wrapper.vm as any).toImages([{ name: "Original", x: [1], y: [99] }]),
  ).rejects.toThrow("does not match");
  expect(plotly.toImage).not.toHaveBeenCalled();
  wrapper.unmount();
});
