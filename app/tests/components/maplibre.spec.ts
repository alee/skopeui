import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createGeomanInstance } from "@geoman-io/maplibre-geoman-free";
import MapLibre from "@/components/dataset/MapLibre.client.vue";
import metadataFixture from "@/tests/fixtures/metadata-1.0.0.json";
import { SkopeColorbar } from "@/utils/skopeColorbar";

const ppt = metadataFixture.datasets[0]!.variables[0]!;

type MockLayer = {
  id: string;
  type: string;
  source: string;
  layout?: Record<string, any>;
};

type MockStyle = {
  version: number;
  sources: Record<string, any>;
  layers: MockLayer[];
};

const mocks = vi.hoisted(() => {
  const routeState = {
    name: "dataset-id",
    params: { id: "paleocar" } as { id: string; variable?: string },
  };

  const appStore = {
    stepNames: [
      "index",
      "dataset-id",
      "dataset-id-visualize-variable",
      "dataset-id-analyze-variable",
    ],
  };

  const datasetStore = {
    metadata: {
      id: "paleocar",
      variables: [],
    },
    variable: null,
    temporalRangeMax: 2000,
    numberOfCells: 0,
    areaInSquareKm: 0,
    geoJson: null,
    get hasGeoJson() {
      return this.geoJson !== null;
    },
  } as any;

  const studyArea = {
    restore: vi.fn(),
    save: vi.fn(),
    clear: vi.fn(),
  };

  const geomanInstance = {
    features: {
      deleteAll: vi.fn(async (): Promise<void> => {}),
      importGeoJson: vi.fn(async (_collection: unknown): Promise<void> => {}),
    },
    destroy: vi.fn(),
  };

  const mapInstances: any[] = [];

  class MockMap {
    style: MockStyle;
    eventHandlers: Record<string, Function[]> = {};

    addControl = vi.fn((control: any) => control?.onAdd?.(this));
    removeControl = vi.fn((control: any) => control?.onRemove?.());
    isSourceLoaded = vi.fn(() => true);
    triggerRepaint = vi.fn();
    setPaintProperty = vi.fn();
    off = vi.fn((event: string, callback: Function) => {
      this.eventHandlers[event] = (this.eventHandlers[event] || []).filter(
        (fn) => fn !== callback,
      );
    });
    fitBounds = vi.fn();
    remove = vi.fn();
    resize = vi.fn();
    setLayoutProperty = vi.fn((id: string, property: string, value: string) => {
      const layer = this.style.layers.find((entry) => entry.id === id);
      if (!layer) return;
      layer.layout = layer.layout || {};
      layer.layout[property] = value;
    });

    constructor(readonly options: any) {
      this.style = {
        version: options.style.version,
        sources: { ...options.style.sources },
        layers: options.style.layers.map((layer: any) => ({
          ...layer,
          layout: layer.layout ? { ...layer.layout } : undefined,
        })),
      };
      mapInstances.push(this);
    }

    on(event: string, callback: Function) {
      if (!this.eventHandlers[event]) {
        this.eventHandlers[event] = [];
      }
      this.eventHandlers[event].push(callback);

      if (event === "load") {
        Promise.resolve().then(() => callback());
      }

      return this;
    }

    getLayer(id: string) {
      return this.style.layers.find((layer) => layer.id === id);
    }

    getStyle() {
      return this.style;
    }

    addSource(id: string, source: any) {
      this.style.sources[id] = source;
    }

    getSource(id: string) {
      const source = this.style.sources[id];
      if (!source) return undefined;
      return {
        setData: vi.fn((data: any) => {
          source.data = data;
        }),
      };
    }

    removeSource(id: string) {
      delete this.style.sources[id];
    }

    addLayer(layer: any) {
      this.style.layers.push({
        ...layer,
        layout: layer.layout ? { ...layer.layout } : undefined,
      });
    }

    removeLayer(id: string) {
      this.style.layers = this.style.layers.filter((layer) => layer.id !== id);
    }
  }

  return {
    routeState,
    appStore,
    datasetStore,
    studyArea,
    geomanInstance,
    mapInstances,
    MockMap,
    download: vi.fn(),
    messageError: vi.fn(),
    removeAttribution: vi.fn(),
  };
});

vi.mock("@/stores/app", () => ({
  useAppStore: () => mocks.appStore,
}));

vi.mock("@/stores/dataset", () => ({
  useDatasetStore: () => mocks.datasetStore,
}));

vi.mock("@/stores/messages", () => ({
  useMessagesStore: () => ({
    error: mocks.messageError,
    info: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock("@/composables/useStudyArea", () => ({
  useStudyArea: () => mocks.studyArea,
}));

vi.mock("maplibre-gl", () => ({
  Map: mocks.MockMap,
  NavigationControl: class MockNavigationControl {},
  AttributionControl: class MockAttributionControl {
    onAdd() {
      const element = document.createElement("div");
      element.textContent = "Map credits";
      return element;
    }
    onRemove = mocks.removeAttribution;
  },
  ScaleControl: class MockScaleControl {},
  setWorkerUrl: vi.fn(),
}));

vi.mock("@geoman-io/maplibre-geoman-free", () => ({
  createGeomanInstance: vi.fn(async () => mocks.geomanInstance),
}));

const VTooltipStub = defineComponent({
  name: "VTooltipStub",
  template: '<div><slot name="activator" :props="{}" /><slot /></div>',
});

const VListItemStub = defineComponent({
  name: "VListItemStub",
  props: { title: { type: String, default: "" } },
  emits: ["click"],
  setup(props, { emit }) {
    return () => h("div", { onClick: () => emit("click") }, props.title);
  },
});

const uiStubs = {
  "v-progress-circular": true,
  "v-card": { template: "<div><slot /></div>" },
  "v-toolbar": { template: "<div><slot /></div>" },
  "v-row": { template: "<div><slot /></div>" },
  "v-spacer": { template: "<div />" },
  "v-text-field": { template: "<input />" },
  "v-btn": { template: "<button><slot /></button>" },
  "v-icon": { template: "<i><slot /></i>" },
  "v-card-text": { template: "<div><slot /></div>" },
  "v-tooltip": VTooltipStub,
  "v-menu": VTooltipStub,
  "v-list": { template: "<div><slot /></div>" },
  "v-list-subheader": { template: "<div><slot /></div>" },
  "v-list-item": VListItemStub,
};

describe("MapLibre", () => {
  beforeEach(() => {
    vi.stubGlobal("useRoute", () => mocks.routeState);
    vi.stubGlobal("useNuxtApp", () => ({
      $download: { saveAs: mocks.download },
    }));
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: {
        apiBase: "https://test.example.com",
        cartoApiKey: "test-carto-key",
      },
    }));
    mocks.routeState.name = "dataset-id";
    mocks.routeState.params = { id: "paleocar" };
    mocks.datasetStore.geoJson = null;
    mocks.datasetStore.metadata = { id: "paleocar", variables: [] } as any;
    mocks.datasetStore.variable = ppt;

    mocks.mapInstances.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("[behavior] keeps credits below the map and detaches them on navigation", async () => {
    let resize!: () => void;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        disconnect = disconnect;
        constructor(callback: () => void) {
          resize = callback;
        }
      },
    );
    const wrapper = mount(MapLibre, { global: { stubs: uiStubs } });
    await flushPromises();
    expect(wrapper.get(".map-attribution").text()).toBe("Map credits");
    expect(wrapper.get(".map-frame").text()).not.toContain("Map credits");
    const map = mocks.mapInstances[0];
    resize();
    expect(map.resize).toHaveBeenCalledOnce();
    wrapper.unmount();
    resize();
    expect(map.resize).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(mocks.removeAttribution).toHaveBeenCalledOnce();
  });

  it("[behavior] discards drawing tools that finish loading after navigation", async () => {
    let finishLoading!: (value: any) => void;
    vi.mocked(createGeomanInstance).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishLoading = resolve;
        }),
    );
    const wrapper = mount(MapLibre, { global: { stubs: uiStubs } });
    await flushPromises();
    expect(createGeomanInstance).toHaveBeenCalled();
    wrapper.unmount();
    finishLoading(mocks.geomanInstance);
    await flushPromises();
    expect(mocks.geomanInstance.destroy).toHaveBeenCalledOnce();
    expect(mocks.geomanInstance.features.deleteAll).not.toHaveBeenCalled();
    expect(wrapper.emitted("mapReady")).toBeUndefined();
  });

  it.each(["dataset-id", "dataset-id-visualize-variable"])(
    "[behavior] starts on the default basemap on %s",
    async (routeName) => {
      mocks.routeState.name = routeName;
      mocks.routeState.params = { id: "paleocar", variable: "ppt_annual" };

      mount(MapLibre, { global: { stubs: uiStubs } });
      await flushPromises();

      const map = mocks.mapInstances[0];
      expect(
        map.getLayer("basemap-layer-esri-worldtopomap").layout?.visibility,
      ).toBe("visible");
      expect(
        map.getLayer("basemap-layer-cartodb-positron").layout?.visibility,
      ).toBe("none");
    },
  );

  it("[behavior] updates basemap visibility when selection changes", async () => {
    const wrapper = mount(MapLibre, {
      global: {
        stubs: uiStubs,
      },
    });

    await flushPromises();
    await nextTick();

    const map = mocks.mapInstances[0];
    // The basemap menu is teleported into its own MapLibre control.
    const control = map.addControl.mock.results
      .map((result: any) => result.value)
      .find((el: any) => el?.querySelector?.('[data-test="basemap-button"]'));
    const carto = [
      ...control.querySelectorAll('[data-test="basemap-option"]'),
    ].find((el: any) => el.textContent === "CartoDB.Positron");
    carto.click();
    await flushPromises();
    await nextTick();

    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      "basemap-layer-cartodb-positron",
      "visibility",
      "visible",
    );
    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      "basemap-layer-esri-worldtopomap",
      "visibility",
      "none",
    );

    expect(
      map.getLayer("basemap-layer-cartodb-positron").layout?.visibility,
    ).toBe("visible");
    expect(
      map.getLayer("basemap-layer-esri-worldtopomap").layout?.visibility,
    ).toBe("none");
  });

  it("[behavior] keeps visualize mode read-only and renders selected area overlay", async () => {
    mocks.routeState.name = "dataset-id-visualize-variable";
    mocks.routeState.params = { id: "paleocar", variable: "tasmax" };
    mocks.datasetStore.geoJson = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
            [0, 0],
          ],
        ],
      },
    };

    await mount(MapLibre, {
      global: {
        stubs: uiStubs,
      },
    });

    await flushPromises();
    await nextTick();

    const map = mocks.mapInstances[0];

    expect(createGeomanInstance).not.toHaveBeenCalled();
    expect(map.getSource("study-area-display")).toBeDefined();
    expect(map.getLayer("study-area-display-fill")).toBeDefined();
    expect(map.getLayer("study-area-display-outline")).toBeDefined();
  });

  it("[behavior] requests tiles by the timestep's key, leaving colouring to the API", async () => {
    mocks.routeState.name = "dataset-id-visualize-variable";
    mocks.routeState.params = { id: "paleocar", variable: "ppt_annual" };
    mocks.datasetStore.variable = ppt;

    await mount(MapLibre, {
      global: { stubs: uiStubs },
      props: { step: 590 },
    });
    await flushPromises();
    await nextTick();

    // No colormap or rescale: the key is padded, and nothing follows it.
    const source = mocks.mapInstances[0].getStyle().sources["cog-source-a"];
    expect(source.tileSize).toBe(256);
    expect(source.tiles[0]).toBe(
      "https://test.example.com/tiles/paleocar/ppt_annual/0590/{z}/{x}/{y}",
    );
  });

  it.each([
    ["paleocar_v3", "ppt_annual", 103, "0103"],
    ["lbda_v2", "pdsi", 1000, "1000"],
  ])(
    "[behavior] shows %s's first raster while drawing an area",
    async (id, variableId, step, key) => {
      mocks.routeState.name = "dataset-id";
      mocks.routeState.params = { id };
      mocks.datasetStore.variable = { ...ppt, id: variableId };

      const wrapper = mount(MapLibre, {
        global: { stubs: uiStubs },
        props: { displayRaster: true, step },
      });
      await flushPromises();

      const map = mocks.mapInstances[0];
      expect(map.getStyle().sources["cog-source-a"].tiles).toEqual([
        `https://test.example.com/tiles/${id}/${variableId}/${key}/{z}/{x}/{y}`,
      ]);
      expect(createGeomanInstance).toHaveBeenCalled();
      expect(
        map.addControl.mock.calls.some(
          ([control]: any[]) => control instanceof SkopeColorbar,
        ),
      ).toBe(true);
      wrapper.unmount();
    },
  );

  it("[behavior] acknowledges a year only after its raster swap renders", async () => {
    mocks.routeState.name = "dataset-id-visualize-variable";
    mocks.routeState.params = { id: "paleocar", variable: "ppt_annual" };
    mocks.datasetStore.variable = ppt;
    const wrapper = mount(MapLibre, {
      global: { stubs: uiStubs },
      props: { step: 103 },
    });
    await flushPromises();
    const map = mocks.mapInstances[0];
    const render = () =>
      [...(map.eventHandlers.render || [])].forEach((fn: Function) => fn());
    map.isSourceLoaded.mockReturnValue(false);
    render();
    expect(wrapper.emitted("stepReady")).toBeUndefined();
    map.isSourceLoaded.mockReturnValue(true);
    render();
    expect(wrapper.emitted("stepReady")).toBeUndefined();
    render();
    expect(wrapper.emitted("stepReady")).toEqual([[103]]);
    await wrapper.setProps({ step: 104 });
    render();
    expect(map.setPaintProperty).toHaveBeenCalledWith(
      "cog-layer-b",
      "raster-opacity",
      0.7,
    );
    expect(wrapper.emitted("stepReady")).toEqual([[103]]);
    render();
    expect(wrapper.emitted("stepReady")).toEqual([[103], [104]]);
    wrapper.unmount();
  });

  it("[behavior] reports raster failures without acknowledging the frame", async () => {
    mocks.routeState.params = { id: "paleocar", variable: "ppt_annual" };
    const wrapper = mount(MapLibre, {
      global: { stubs: uiStubs },
      props: { step: 103 },
    });
    await flushPromises();
    const map = mocks.mapInstances[0];
    map.eventHandlers.error.forEach((fn: Function) =>
      fn({ sourceId: "cog-source-a" }),
    );
    expect(wrapper.emitted("stepError")).toEqual([[103]]);
    expect(wrapper.emitted("stepReady")).toBeUndefined();
    expect(map.eventHandlers.render).toEqual([]);
    wrapper.unmount();
  });

  it("[behavior] preloads without advancing, then reuses the buffer at the deadline", async () => {
    const wrapper = mount(MapLibre, {
      global: { stubs: uiStubs },
      props: { step: 103 },
    });
    await flushPromises();
    const map = mocks.mapInstances[0];
    const render = () =>
      [...map.eventHandlers.render].forEach((fn: Function) => fn());
    render();
    render();
    await wrapper.setProps({ preloadStep: 104 });
    const buffer = map.getStyle().sources["cog-source-b"];
    expect(buffer.tiles[0]).toContain("/0104/");
    render();
    render();
    expect(wrapper.emitted("stepReady")).toEqual([[103]]);
    expect(map.setPaintProperty).not.toHaveBeenCalled();
    await wrapper.setProps({ step: 104, preloadStep: null });
    expect(map.getStyle().sources["cog-source-b"]).toBe(buffer);
    map.isSourceLoaded.mockReturnValue(false);
    render();
    expect(map.getSource("cog-source-a")).toBeDefined();
    expect(wrapper.emitted("stepReady")).toEqual([[103]]);
    map.isSourceLoaded.mockReturnValue(true);
    render();
    render();
    expect(wrapper.emitted("stepReady")).toEqual([[103], [104]]);
    await wrapper.setProps({ preloadStep: 106 });
    expect(map.getStyle().sources["cog-source-a"].tiles[0]).toContain("/0106/");
    await wrapper.setProps({ preloadStep: null });
    expect(map.getSource("cog-source-a")).toBeUndefined();
    expect(map.getSource("cog-source-b")).toBeDefined();
    wrapper.unmount();
  });

  it("[behavior] retries a failed preload when requested without interrupting playback", async () => {
    const wrapper = mount(MapLibre, {
      global: { stubs: uiStubs },
      props: { step: 103 },
    });
    await flushPromises();
    const map = mocks.mapInstances[0];
    const render = () =>
      [...map.eventHandlers.render].forEach((fn: Function) => fn());
    render();
    render();
    await wrapper.setProps({ preloadStep: 104 });
    map.eventHandlers.error.forEach((fn: Function) =>
      fn({ sourceId: "cog-source-b" }),
    );
    expect(wrapper.emitted("stepError")).toBeUndefined();
    expect(map.getSource("cog-source-b")).toBeUndefined();
    await wrapper.setProps({ step: 104, preloadStep: null });
    expect(map.getStyle().sources["cog-source-b"].tiles[0]).toContain("/0104/");
    render();
    render();
    expect(wrapper.emitted("stepReady")).toEqual([[103], [104]]);
    wrapper.unmount();
  });

  it("[behavior] discards lookahead when manually selecting a different year", async () => {
    const wrapper = mount(MapLibre, {
      global: { stubs: uiStubs },
      props: { step: 103 },
    });
    await flushPromises();
    const map = mocks.mapInstances[0];
    const render = () =>
      [...map.eventHandlers.render].forEach((fn: Function) => fn());
    render();
    render();
    await wrapper.setProps({ preloadStep: 104 });
    await wrapper.setProps({ step: 106, preloadStep: null });
    expect(map.getStyle().sources["cog-source-b"].tiles[0]).toContain("/0106/");
    render();
    render();
    expect(wrapper.emitted("stepReady")).toEqual([[103], [106]]);
    wrapper.unmount();
  });

  it("[behavior] draws the legend from the display entry unchanged", async () => {
    mocks.routeState.name = "dataset-id-visualize-variable";
    mocks.routeState.params = { id: "paleocar", variable: "ppt_annual" };
    mocks.datasetStore.variable = ppt;

    await mount(MapLibre, { global: { stubs: uiStubs } });
    await flushPromises();
    await nextTick();

    const colorbar = mocks.mapInstances[0].addControl.mock.calls
      .map(([control]: any[]) => control)
      .find((control: any) => control instanceof SkopeColorbar);
    expect(colorbar._options).toEqual({
      colors: ppt.display.colors,
      range: [0, 1807.5],
      ticks: 5,
      units: "mm",
    });
  });

  it("[behavior] opens on the dataset's map_view", async () => {
    mocks.datasetStore.metadata = {
      id: "paleocar",
      variables: [],
      bbox: [-115, 31, -102, 43],
      map_view: { center: { lon: -108.5, lat: 37 }, zoom: 4 },
    };

    mount(MapLibre, { global: { stubs: uiStubs } });
    await flushPromises();

    const { options } = mocks.mapInstances[0];
    expect(options.center).toEqual([-108.5, 37]);
    expect(options.zoom).toBe(4);
    expect(options.bounds).toBeUndefined();
  });

  it("[behavior] fits the dataset's bbox without a map_view", async () => {
    mocks.datasetStore.metadata = {
      id: "paleocar",
      variables: [],
      bbox: [-115, 31, -102, 43],
      map_view: null,
    };

    mount(MapLibre, { global: { stubs: uiStubs } });
    await flushPromises();

    const { options } = mocks.mapInstances[0];
    expect(options.bounds).toEqual([-115, 31, -102, 43]);
    expect(options.center).toBeUndefined();
  });

  it("[behavior] outlines the bbox and requests tiles only inside it", async () => {
    mocks.routeState.name = "dataset-id-visualize-variable";
    mocks.routeState.params = { id: "paleocar", variable: "tasmax" };
    mocks.datasetStore.metadata = {
      id: "paleocar",
      variables: [],
      bbox: [-115, 31, -102, 43],
      map_view: null,
    };

    mount(MapLibre, { global: { stubs: uiStubs } });
    await flushPromises();
    await nextTick();

    const { sources } = mocks.mapInstances[0].getStyle();
    expect(sources["cog-source-a"].bounds).toEqual([-115, 31, -102, 43]);
    expect(
      sources["dataset-region"].data.features[0].geometry.coordinates,
    ).toEqual([
      [
        [-115, 31],
        [-102, 31],
        [-102, 43],
        [-115, 43],
        [-115, 31],
      ],
    ]);
  });

  it("[behavior] draws a point study area and doesn't zoom all the way in", async () => {
    mocks.routeState.name = "dataset-id-visualize-variable";
    mocks.routeState.params = { id: "paleocar", variable: "ppt_annual" };
    mocks.datasetStore.geoJson = {
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [-108.5, 37] },
    };

    mount(MapLibre, { global: { stubs: uiStubs } });
    await flushPromises();
    await nextTick();

    const map = mocks.mapInstances[0];
    const point = map.getLayer("study-area-display-point");
    expect(point.type).toBe("circle");
    expect(point.filter).toEqual(["==", ["geometry-type"], "Point"]);
    expect(map.fitBounds).toHaveBeenCalledWith(
      [
        [-108.5, 37],
        [-108.5, 37],
      ],
      expect.objectContaining({ maxZoom: 10 }),
    );
  });

  it("[behavior] offers only the four study-area drawing tools", async () => {
    mount(MapLibre, { global: { stubs: uiStubs } });
    await flushPromises();

    const [, options] = vi.mocked(createGeomanInstance).mock.calls[0]!;
    const { draw, edit, helper } = (options as any).controls;
    expect(
      Object.keys(draw).filter((mode) => draw[mode].uiEnabled === false),
    ).toEqual(["circle_marker", "text_marker", "ellipse", "line"]);
    expect(edit.cut.uiEnabled).toBe(false);
    // Snapping stays on without its button: it closes a polygon near its
    // first corner.
    expect(helper.snapping).toEqual({ uiEnabled: false, active: true });
  });

  it("[behavior] explains the active drawing tool next to the pointer", async () => {
    const wrapper = mount(MapLibre, { global: { stubs: uiStubs } });
    await flushPromises();
    const handlers = mocks.mapInstances[0].eventHandlers;
    const cursorHint = () => wrapper.find('[data-test="draw-cursor-hint"]');
    const callout = () => wrapper.find('[data-test="draw-callout"]');
    expect(callout().text()).toMatch(/Choose a shape/);
    const [moved] = handlers.mousemove;
    moved({ point: { x: 120, y: 80 } });
    await nextTick();
    expect(cursorHint().exists()).toBe(false);

    const [toggled] = handlers["gm:globaldrawmodetoggled"];
    toggled({ enabled: true, shape: "circle" });
    await nextTick();
    expect(cursorHint().text()).toBe(
      "Click the center, then click again to set the radius.",
    );
    expect(cursorHint().attributes("style")).toContain("left: 120px");
    // The header's callout stays while a tool is active.
    expect(callout().text()).toMatch(/Choose a shape/);

    const [left] = handlers.mouseout;
    left();
    await nextTick();
    expect(cursorHint().exists()).toBe(false);

    moved({ point: { x: 10, y: 10 } });
    toggled({ enabled: false, shape: "circle" });
    await nextTick();
    expect(cursorHint().exists()).toBe(false);
    expect(callout().text()).toMatch(/Choose a shape/);
  });

  it("[behavior] explains the edit tools once there's a shape", async () => {
    mocks.datasetStore.geoJson = {
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [-108.5, 37] },
    } as any;
    const wrapper = mount(MapLibre, { global: { stubs: uiStubs } });
    await flushPromises();
    const handlers = mocks.mapInstances[0].eventHandlers;
    const callout = () => wrapper.find('[data-test="draw-callout"]');
    const cursorHint = () => wrapper.find('[data-test="draw-cursor-hint"]');
    expect(callout().text()).toMatch(/Draw a new shape to replace this one/);

    handlers.mousemove[0]({ point: { x: 120, y: 80 } });
    // geoman calls the change mode "edit" in its events.
    const [changeToggled] = handlers["gm:globaleditmodetoggled"];
    const [rotateToggled] = handlers["gm:globalrotatemodetoggled"];
    changeToggled({ enabled: true });
    await nextTick();
    expect(cursorHint().text()).toBe("Drag a corner to change the shape.");
    expect(callout().text()).toMatch(/Draw a new shape to replace this one/);

    // Switching tools may report the new one before the old one ends.
    rotateToggled({ enabled: true });
    changeToggled({ enabled: false });
    await nextTick();
    expect(cursorHint().text()).toBe("Drag a corner to rotate the shape.");

    rotateToggled({ enabled: false });
    await nextTick();
    expect(cursorHint().exists()).toBe(false);
    expect(callout().exists()).toBe(true);
  });

  it("[behavior] offers the GeoJSON download only once there's a shape", async () => {
    const downloadDisabled = async () => {
      const wrapper = mount(MapLibre, { global: { stubs: uiStubs } });
      await flushPromises();
      return wrapper
        .findAll("button")
        .find((b) => b.text() === "Download GeoJSON")!
        .attributes("disabled");
    };
    expect(await downloadDisabled()).toBeDefined();

    mocks.datasetStore.geoJson = {
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [-108.5, 37] },
    } as any;
    expect(await downloadDisabled()).toBeUndefined();
  });

  it("[behavior] downloads the shape from the button's activation handler", async () => {
    mocks.datasetStore.geoJson = {
      type: "Point",
      coordinates: [-108, 37],
    };
    const wrapper = mount(MapLibre, { global: { stubs: uiStubs } });
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Download GeoJSON")!
      .trigger("click");
    expect(mocks.download).toHaveBeenCalledWith(
      expect.any(Blob),
      "paleocar.geojson",
    );
    expect(wrapper.find("button a").exists()).toBe(false);
    wrapper.unmount();
  });

  it.each(["{}", "not JSON"])(
    "[behavior] preserves the selected area after invalid upload: %s",
    async (text) => {
      const area = { type: "Point", coordinates: [-108, 37] };
      mocks.datasetStore.geoJson = area;
      const wrapper = mount(MapLibre, { global: { stubs: uiStubs } });
      const input = wrapper.get<HTMLInputElement>("#loadGeoJsonFile");
      Object.defineProperty(input.element, "files", {
        value: [{ text: async () => text }],
      });
      await input.trigger("change");
      await flushPromises();
      expect(mocks.studyArea.save).not.toHaveBeenCalled();
      expect(mocks.datasetStore.geoJson).toBe(area);
      expect(mocks.messageError).toHaveBeenCalledWith(
        expect.stringContaining("Your current selection has been kept."),
      );
      wrapper.unmount();
    },
  );

  it("[behavior] reports file read failures without replacing the selection", async () => {
    const wrapper = mount(MapLibre, { global: { stubs: uiStubs } });
    const input = wrapper.get<HTMLInputElement>("#loadGeoJsonFile");
    Object.defineProperty(input.element, "files", {
      value: [
        {
          text: async () => {
            throw new Error("File unavailable");
          },
        },
      ],
    });
    await input.trigger("change");
    await flushPromises();
    expect(mocks.studyArea.save).not.toHaveBeenCalled();
    expect(mocks.messageError).toHaveBeenCalledWith(
      expect.stringContaining("Unable to import"),
    );
    wrapper.unmount();
  });

  it.each(["navigation", "unmount", "newer upload"])(
    "[behavior] discards an upload that finishes after %s",
    async (interruption) => {
      let finishReading!: (text: string) => void;
      const wrapper = mount(MapLibre, { global: { stubs: uiStubs } });
      const input = wrapper.get<HTMLInputElement>("#loadGeoJsonFile");
      Object.defineProperty(input.element, "files", {
        configurable: true,
        value: [
          {
            text: () =>
              new Promise<string>((resolve) => {
                finishReading = resolve;
              }),
          },
        ],
      });
      await input.trigger("change");
      if (interruption === "navigation")
        mocks.routeState.params.id = "another_dataset";
      else if (interruption === "unmount") wrapper.unmount();
      else {
        Object.defineProperty(input.element, "files", {
          value: [{ text: async () => "{}" }],
        });
        await input.trigger("change");
        await flushPromises();
        mocks.messageError.mockClear();
      }
      finishReading('{"type":"Point","coordinates":[-108,37]}');
      await flushPromises();
      expect(mocks.studyArea.save).not.toHaveBeenCalled();
      expect(mocks.messageError).not.toHaveBeenCalled();
      if (interruption !== "unmount") wrapper.unmount();
    },
  );

  it("[behavior] imports one normalized feature", async () => {
    const wrapper = mount(MapLibre, { global: { stubs: uiStubs } });
    const input = wrapper.get<HTMLInputElement>("#loadGeoJsonFile");
    const geometry = { type: "Point", coordinates: [-108, 37] };
    Object.defineProperty(input.element, "files", {
      value: [{ text: async () => JSON.stringify(geometry) }],
    });
    await input.trigger("change");
    await flushPromises();
    expect(mocks.studyArea.save).toHaveBeenCalledWith({
      type: "Feature",
      properties: {},
      geometry,
    });
    expect(input.element.value).toBe("");
    wrapper.unmount();
  });

  it("[behavior] zooms to a point shape without zooming all the way in", async () => {
    vi.useFakeTimers();
    mocks.datasetStore.geoJson = {
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [-108.5, 37] },
    } as any;
    mount(MapLibre, { global: { stubs: uiStubs } });
    await vi.runAllTimersAsync();
    const map = mocks.mapInstances[0];
    map.fitBounds.mockClear();

    const [zoomed] = map.eventHandlers["gm:globalzoom_to_featuresmodetoggled"];
    zoomed({ enabled: true });
    vi.runAllTimers();
    vi.useRealTimers();

    expect(map.fitBounds).toHaveBeenCalledWith(
      [
        [-108.5, 37],
        [-108.5, 37],
      ],
      expect.objectContaining({ maxZoom: 10 }),
    );
  });
  it("[behavior] replaces a pending frame without acknowledging its stale render callbacks", async () => {
    mocks.routeState.name = "dataset-id-visualize-variable";
    mocks.routeState.params = { id: "paleocar", variable: "ppt_annual" };
    const wrapper = mount(MapLibre, {
      global: { stubs: uiStubs },
      props: { step: 103 },
    });
    await flushPromises();
    const map = mocks.mapInstances[0];
    const render = () =>
      [...(map.eventHandlers.render || [])].forEach((handler: Function) =>
        handler(),
      );
    render();
    render();
    await wrapper.setProps({ step: 104 });
    const stale = [...map.eventHandlers.render];
    await wrapper.setProps({ step: 105 });
    stale.forEach((handler) => handler());
    expect(wrapper.emitted("stepReady")).toEqual([[103]]);
    render();
    render();
    expect(wrapper.emitted("stepReady")).toEqual([[103], [105]]);
    const rasters = Object.values(map.getStyle().sources).filter(
      (source: any) => source.tiles?.[0]?.includes("/tiles/paleocar/"),
    ) as any[];
    expect(rasters).toHaveLength(1);
    expect(rasters[0].tiles[0]).toContain("/0105/");
    wrapper.unmount();
  });

  it("[behavior] ignores unrelated source errors while waiting for a raster", async () => {
    mocks.routeState.name = "dataset-id-visualize-variable";
    mocks.routeState.params = { id: "paleocar", variable: "ppt_annual" };
    const wrapper = mount(MapLibre, {
      global: { stubs: uiStubs },
      props: { step: 103 },
    });
    await flushPromises();
    const map = mocks.mapInstances[0];
    map.eventHandlers.error.forEach((handler: Function) =>
      handler({ sourceId: "basemap-source-esri-worldtopomap" }),
    );
    expect(wrapper.emitted("stepError")).toBeUndefined();
    for (let i = 0; i < 2; i++)
      [...map.eventHandlers.render].forEach((handler: Function) => handler());
    expect(wrapper.emitted("stepReady")).toEqual([[103]]);
    wrapper.unmount();
  });

  it("[behavior] detaches rendering and drawing handlers before destroying the map", async () => {
    mocks.datasetStore.variable = ppt;
    const wrapper = mount(MapLibre, { global: { stubs: uiStubs } });
    await flushPromises();
    const map = mocks.mapInstances[0];
    const staleRender = [...map.eventHandlers.render];
    const staleCreate = [...map.eventHandlers["gm:create"]];
    const staleRemove = [...map.eventHandlers["gm:remove"]];
    const colorbar = map.addControl.mock.calls
      .map(([control]: any[]) => control)
      .find((control: any) => control instanceof SkopeColorbar);
    wrapper.unmount();
    staleRender.forEach((handler) => handler());
    staleCreate.forEach((handler) =>
      handler({
        feature: { getGeoJson: () => ({ type: "Point", coordinates: [0, 0] }) },
      }),
    );
    staleRemove.forEach((handler) => handler());
    expect(wrapper.emitted("stepReady")).toBeUndefined();
    expect(mocks.studyArea.save).not.toHaveBeenCalled();
    expect(mocks.studyArea.clear).not.toHaveBeenCalled();
    expect(map.eventHandlers.render).toEqual([]);
    expect(map.eventHandlers.error).toEqual([]);
    expect(map.eventHandlers["gm:create"]).toEqual([]);
    expect(map.eventHandlers.load).toEqual([]);
    expect(map.removeControl).toHaveBeenCalledWith(colorbar);
    expect(mocks.geomanInstance.destroy).toHaveBeenCalledOnce();
    expect(map.remove).toHaveBeenCalledOnce();
  });

  it("[behavior] stops drawing initialization if navigation occurs during geometry synchronization", async () => {
    let finishDelete!: () => void;
    mocks.geomanInstance.features.deleteAll.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishDelete = resolve;
        }),
    );
    const wrapper = mount(MapLibre, { global: { stubs: uiStubs } });
    await flushPromises();
    wrapper.unmount();
    finishDelete();
    await flushPromises();
    expect(mocks.geomanInstance.features.importGeoJson).not.toHaveBeenCalled();
    expect(mocks.geomanInstance.destroy).toHaveBeenCalledOnce();
    expect(wrapper.emitted("mapReady")).toBeUndefined();
  });

  it("[behavior] synchronizes stored geometry without saving Geoman's programmatic events", async () => {
    const previousStore = mocks.datasetStore;
    const liveStore = reactive({ ...previousStore, geoJson: null });
    mocks.datasetStore = liveStore;
    const wrapper = mount(MapLibre, { global: { stubs: uiStubs } });
    try {
      await flushPromises();
      const map = mocks.mapInstances[0];
      let finishDelete!: () => void;
      mocks.geomanInstance.features.deleteAll.mockImplementationOnce(() => {
        map.eventHandlers["gm:remove"].forEach((handler: Function) =>
          handler(),
        );
        return new Promise<void>((resolve) => {
          finishDelete = resolve;
        });
      });
      const point = {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [-108, 37] },
      };
      mocks.geomanInstance.features.importGeoJson.mockImplementationOnce(
        async (collection: any) => {
          collection.features[0].properties.pluginValue = "transient";
          map.eventHandlers["gm:create"].forEach((handler: Function) =>
            handler({ feature: { getGeoJson: () => point } }),
          );
        },
      );
      liveStore.geoJson = point;
      await flushPromises();
      finishDelete();
      await flushPromises();
      expect(mocks.studyArea.save).not.toHaveBeenCalled();
      expect(mocks.studyArea.clear).not.toHaveBeenCalled();
      expect(liveStore.geoJson).toEqual(point);
      expect(point.properties).toEqual({});
      expect(mocks.geomanInstance.features.importGeoJson).toHaveBeenCalledWith({
        type: "FeatureCollection",
        features: [{ ...point, properties: { pluginValue: "transient" } }],
      });
      map.eventHandlers["gm:create"].forEach((handler: Function) =>
        handler({ feature: { getGeoJson: () => point } }),
      );
      expect(mocks.studyArea.save).toHaveBeenCalledWith(point);
    } finally {
      wrapper.unmount();
      mocks.datasetStore = previousStore;
    }
  });

  it("[behavior] cancels a scheduled geometry zoom when the map is removed", async () => {
    vi.useFakeTimers();
    const wrapper = mount(MapLibre, { global: { stubs: uiStubs } });
    try {
      await flushPromises();
      const map = mocks.mapInstances[0];
      map.fitBounds.mockClear();
      map.eventHandlers["gm:globalzoom_to_featuresmodetoggled"][0]({
        enabled: true,
      });
      wrapper.unmount();
      await vi.runAllTimersAsync();
      expect(map.fitBounds).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("[behavior] gives each map its own drawing configuration", async () => {
    const first = mount(MapLibre, { global: { stubs: uiStubs } });
    await flushPromises();
    const firstOptions = vi.mocked(createGeomanInstance).mock
      .calls[0]![1] as any;
    firstOptions.controls.draw.marker.title = "changed by plugin";
    first.unmount();
    const second = mount(MapLibre, { global: { stubs: uiStubs } });
    await flushPromises();
    const secondOptions = vi.mocked(createGeomanInstance).mock
      .calls[1]![1] as any;
    expect(secondOptions.controls.draw.marker.title).toBe(
      "Point: Click the map to place the point.",
    );
    expect(secondOptions.layerStyles).not.toBe(firstOptions.layerStyles);
    second.unmount();
  });

  it("[behavior] replaces the raster when its variable changes without acknowledging the old frame", async () => {
    const previousRoute = mocks.routeState;
    const route = reactive({
      name: "dataset-id-visualize-variable",
      params: { id: "paleocar", variable: "ppt_annual" },
    });
    mocks.routeState = route;
    const wrapper = mount(MapLibre, {
      global: { stubs: uiStubs },
      props: { step: 103 },
    });
    try {
      await flushPromises();
      const map = mocks.mapInstances[0];
      const staleRender = [...map.eventHandlers.render];
      route.params.variable = "tasmax";
      await flushPromises();
      staleRender.forEach((handler) => handler());
      expect(wrapper.emitted("stepReady")).toBeUndefined();
      const sources = Object.values(map.getStyle().sources).filter(
        (source: any) => source.tiles?.[0]?.includes("/tiles/paleocar/"),
      ) as any[];
      expect(sources).toHaveLength(1);
      expect(sources[0].tiles[0]).toBe(
        "https://test.example.com/tiles/paleocar/tasmax/0103/{z}/{x}/{y}",
      );
      for (let i = 0; i < 2; i++)
        [...map.eventHandlers.render].forEach((handler: Function) => handler());
      expect(wrapper.emitted("stepReady")).toEqual([[103]]);
    } finally {
      wrapper.unmount();
      mocks.routeState = previousRoute;
    }
  });
  it("[behavior] retains a newer store selection while an earlier drawing import is pending", async () => {
    const previousStore = mocks.datasetStore;
    const liveStore = reactive({ ...previousStore, geoJson: null });
    mocks.datasetStore = liveStore;
    const wrapper = mount(MapLibre, { global: { stubs: uiStubs } });
    try {
      await flushPromises();
      let finishDelete!: () => void;
      mocks.geomanInstance.features.deleteAll.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishDelete = resolve;
          }),
      );
      const first = { type: "Point", coordinates: [1, 2] };
      const latest = { type: "Point", coordinates: [3, 4] };
      liveStore.geoJson = first;
      await flushPromises();
      liveStore.geoJson = latest;
      await flushPromises();
      finishDelete();
      await flushPromises();
      expect(
        mocks.geomanInstance.features.importGeoJson,
      ).toHaveBeenLastCalledWith({
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: {}, geometry: latest }],
      });
      expect(mocks.studyArea.save).not.toHaveBeenCalled();
      expect(mocks.studyArea.clear).not.toHaveBeenCalled();
    } finally {
      wrapper.unmount();
      mocks.datasetStore = previousStore;
    }
  });
});
