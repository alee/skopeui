import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Preview from "@/components/dataset/DatasetMapPreview.client.vue";

const mocks = vi.hoisted(() => {
  const maps: any[] = [];
  const resizes: any[] = [];
  class MockMap {
    sources: Record<string, any>;
    layers: any[];
    handlers: Record<string, Function[]> = {};
    resize = vi.fn();
    remove = vi.fn();
    fitBounds = vi.fn();
    jumpTo = vi.fn();
    addControl = vi.fn();
    constructor(readonly options: any) {
      this.sources = { ...options.style.sources };
      this.layers = [...options.style.layers];
      maps.push(this);
    }
    on(name: string, callback: Function) {
      (this.handlers[name] ||= []).push(callback);
      if (name === "load") Promise.resolve().then(() => callback());
    }
    off(name: string, callback: Function) {
      this.handlers[name] = (this.handlers[name] || []).filter(
        (handler) => handler !== callback,
      );
    }
    addSource(id: string, source: any) {
      this.sources[id] = source;
    }
    addLayer(layer: any) {
      this.layers.push(layer);
    }
    getSource(id: string) {
      return this.sources[id]
        ? {
            setData: (data: any) => {
              this.sources[id].data = data;
            },
          }
        : undefined;
    }
  }
  return { maps, resizes, MockMap };
});
vi.mock("maplibre-gl", () => ({
  Map: mocks.MockMap,
  setWorkerUrl: vi.fn(),
  ScaleControl: class {},
}));
const bbox: [number, number, number, number] = [-115, 31, -102, 43];
const props = { bbox, title: "PaleoCAR", mapView: null };

beforeEach(() => {
  mocks.maps.length = 0;
  mocks.resizes.length = 0;
  vi.stubGlobal("IntersectionObserver", undefined);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      disconnect = vi.fn();
      constructor(readonly callback: () => void) {
        mocks.resizes.push(this);
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("dataset MapLibre preview", () => {
  it("fits the advertised extent and draws it above the default topographic map", async () => {
    const wrapper = mount(Preview, { props });
    await flushPromises();
    const map = mocks.maps[0];
    expect(map.options.bounds).toEqual(bbox);
    expect(map.options.interactive).toBe(false);
    expect(Object.keys(map.options.style.sources)).toEqual([
      "basemap-source-esri-worldtopomap",
    ]);
    expect(
      map.sources["preview-region"].data.features[0].geometry.coordinates[0],
    ).toEqual([
      [-115, 31],
      [-102, 31],
      [-102, 43],
      [-115, 43],
      [-115, 31],
    ]);
    expect(
      map.layers.find((layer: any) => layer.id === "preview-region-fill").paint[
        "fill-opacity"
      ],
    ).toBe(0.12);
    wrapper.unmount();
  });
  it("preserves map_view and responds to metadata updates without recreating the map", async () => {
    const wrapper = mount(Preview, {
      props: {
        ...props,
        mapView: { center: { lon: -108.5, lat: 37 }, zoom: 4 },
      },
    });
    await flushPromises();
    const map = mocks.maps[0];
    expect(map.options.center).toEqual([-108.5, 37]);
    expect(map.options.zoom).toBe(4);
    const changed: typeof bbox = [-114, 32, -103, 42];
    await wrapper.setProps({ bbox: changed, mapView: null });
    expect(map.fitBounds).toHaveBeenLastCalledWith(changed, {
      padding: 20,
      duration: 0,
    });
    expect(mocks.maps).toHaveLength(1);
    wrapper.unmount();
  });
  it("resizes when card height changes and detaches its observer and map on unmount", async () => {
    const wrapper = mount(Preview, { props });
    await flushPromises();
    const map = mocks.maps[0];
    const resize = mocks.resizes[0];
    resize.callback();
    expect(map.resize).toHaveBeenCalledOnce();
    wrapper.unmount();
    resize.callback();
    expect(map.resize).toHaveBeenCalledOnce();
    expect(resize.disconnect).toHaveBeenCalledOnce();
    expect(map.remove).toHaveBeenCalledOnce();
    expect(map.handlers.load).toEqual([]);
  });
  it("ignores a load callback queued before disposal", async () => {
    const wrapper = mount(Preview, { props });
    const map = mocks.maps[0];
    wrapper.unmount();
    await flushPromises();
    expect(map.sources["preview-region"]).toBeUndefined();
    expect(map.fitBounds).not.toHaveBeenCalled();
  });
  it("creates and releases WebGL maps as previews enter and leave the viewport", async () => {
    let visibility!: (entries: Array<{ isIntersecting: boolean }>) => void;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe = vi.fn();
        disconnect = disconnect;
        constructor(callback: typeof visibility) {
          visibility = callback;
        }
      },
    );
    const wrapper = mount(Preview, { props });
    expect(mocks.maps).toHaveLength(0);
    visibility([{ isIntersecting: true }]);
    await flushPromises();
    expect(mocks.maps).toHaveLength(1);
    visibility([{ isIntersecting: false }]);
    expect(mocks.maps[0].remove).toHaveBeenCalledOnce();
    visibility([{ isIntersecting: true }]);
    await flushPromises();
    expect(mocks.maps).toHaveLength(2);
    wrapper.unmount();
    visibility([{ isIntersecting: true }]);
    expect(mocks.maps).toHaveLength(2);
    expect(mocks.maps[1].remove).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
