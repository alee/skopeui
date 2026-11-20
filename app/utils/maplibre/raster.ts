import type { Bbox } from "@/composables/useMapInitialViewport";
import type { Map } from "maplibre-gl";
import { SkopeColorbar, type ColorbarOptions } from "@/utils/skopeColorbar";
import { timestepKey } from "@/utils/timeAxis";
import { FILL_LAYER_ID } from "./config";

interface RasterOptions {
  baseUrl: () => string | null;
  bounds: () => Bbox | undefined;
  displayRaster: () => boolean;
  legendOptions: () => ColorbarOptions | null;
  legendPosition: () => "bottom-left" | "bottom-right";
  onInvalidLegend: () => void;
  onLoading: (loading: boolean) => void;
  onReady: (step: number) => void;
  onError: (step: number) => void;
}

export function createRasterController(options: RasterOptions) {
  let map: Map | null = null;
  let isMapLoaded = false;
  let colorbar: SkopeColorbar | null = null;
  const COG_A = { sourceId: "cog-source-a", layerId: "cog-layer-a" };
  const COG_B = { sourceId: "cog-source-b", layerId: "cog-layer-b" };
  let cogFront = COG_A; // currently visible slot
  let cogBack = COG_B; // currently loading / empty slot
  let preloadedStep: number | null = null;
  let pendingFrameCheck: (() => void) | null = null;
  let pendingFrameSource: string | null = null;
  let pendingFrameStep: number | null = null;
  // The API colours tiles from the variable's display entry, so the URL carries
  // no colormap or rescale.
  function getCogFullUrl(baseUrl: string, step: number) {
    return `${baseUrl}/${timestepKey(step)}/{z}/{x}/{y}`;
  }

  // Tiles are only requested inside the dataset's bbox, [west, south, east, north].
  function getCogBounds(): Bbox | undefined {
    return options.bounds();
  }

  function addCogSlot(slot: typeof COG_A, step: number, opacity: number) {
    const baseUrl = options.baseUrl();
    if (!map || !isMapLoaded || !baseUrl) return;
    const url = getCogFullUrl(baseUrl, step);
    const bounds = getCogBounds();
    map.addSource(slot.sourceId, {
      type: "raster",
      tiles: [url],
      // TiTiler serves the WebMercatorQuad matrix at its native 256px size.
      tileSize: 256,
      ...(bounds && { bounds }),
    });
    map.addLayer(
      {
        id: slot.layerId,
        type: "raster",
        source: slot.sourceId,
        paint: {
          "raster-opacity": opacity,
          "raster-opacity-transition": { duration: 0 },
          "raster-fade-duration": 0,
        },
      },
      FILL_LAYER_ID,
    );
  }

  function removeCogSlot(slot: typeof COG_A) {
    if (!map) return;
    if (map.getLayer(slot.layerId)) map.removeLayer(slot.layerId);
    if (map.getSource(slot.sourceId)) map.removeSource(slot.sourceId);
  }

  function cancelPendingSwap() {
    if (pendingFrameCheck) {
      map?.off("render", pendingFrameCheck);
      pendingFrameCheck = null;
      pendingFrameSource = null;
      pendingFrameStep = null;
      preloadedStep = null;
      removeCogSlot(cogBack); // discard the back buffer that was loading
    }
  }

  // Readiness belongs to the requested raster, not to unrelated basemap loads.
  // A second render confirms the opacity swap before the plot advances.
  function waitForFrame(slot: typeof COG_A, step: number, swap: boolean) {
    if (!map) return;
    pendingFrameSource = slot.sourceId;
    pendingFrameStep = step;
    options.onLoading(true);
    const check = () => {
      if (
        !map ||
        pendingFrameCheck !== check ||
        !map.isSourceLoaded(slot.sourceId)
      )
        return;
      map.off("render", check);
      if (swap) {
        map.setPaintProperty(slot.layerId, "raster-opacity", 0.7);
        removeCogSlot(cogFront);
        [cogFront, cogBack] = [cogBack, cogFront];
        preloadedStep = null;
      }
      const displayed = () => {
        if (!map || pendingFrameCheck !== displayed) return;
        map.off("render", displayed);
        pendingFrameCheck = null;
        pendingFrameSource = null;
        pendingFrameStep = null;
        options.onLoading(false);
        options.onReady(step);
      };
      pendingFrameCheck = displayed;
      map.on("render", displayed);
      map.triggerRepaint();
    };
    pendingFrameCheck = check;
    map.on("render", check);
    map.triggerRepaint();
  }

  function addCogRasterLayer(step: number) {
    if (!map || !isMapLoaded || !options.baseUrl()) return;
    cancelPendingSwap();
    removeCogSlot(cogFront);
    removeCogSlot(cogBack);
    cogFront = COG_A;
    cogBack = COG_B;
    addCogSlot(cogFront, step, 0.7);
    waitForFrame(cogFront, step, false);
  }

  function removeCogRasterLayer() {
    if (!map || !isMapLoaded) return;
    cancelPendingSwap();
    removeCogSlot(cogFront);
    removeCogSlot(cogBack);
    preloadedStep = null;
    options.onLoading(false);
  }

  function updateRasterLayer(step: number) {
    if (!map || !isMapLoaded || !options.baseUrl()) return;
    if (!map.getSource(cogFront.sourceId)) {
      addCogRasterLayer(step);
      return;
    }

    if (preloadedStep !== step) {
      cancelPendingSwap();
      removeCogSlot(cogBack);
      addCogSlot(cogBack, step, 0);
    }
    preloadedStep = null;
    waitForFrame(cogBack, step, true);
  }

  // One frame of lookahead, using the same source later committed by updateStep.
  // No readiness events or loading indicator until the frame is requested.
  function preloadStep(step: number | null) {
    if (!map || !isMapLoaded || pendingFrameCheck || !options.baseUrl()) return;
    if (step === preloadedStep) return;
    removeCogSlot(cogBack);
    preloadedStep = step;
    if (step != null) addCogSlot(cogBack, step, 0);
  }

  function handleError(event: unknown) {
    if (
      event &&
      typeof event === "object" &&
      "sourceId" in event &&
      event.sourceId === cogBack.sourceId &&
      preloadedStep != null
    ) {
      // A speculative failure should not interrupt the visible year. Retry
      // through the normal requested-frame path when its deadline arrives.
      preloadStep(null);
      return;
    }
    if (
      !event ||
      typeof event !== "object" ||
      !("sourceId" in event) ||
      !pendingFrameSource ||
      event.sourceId !== pendingFrameSource
    )
      return;
    const step = pendingFrameStep;
    cancelPendingSwap();
    options.onLoading(false);
    if (step != null) options.onError(step);
  }

  function initialize(target: Map, step: number) {
    map = target;
    isMapLoaded = true;
    map.on("error", handleError);
    addCogRasterLayer(step);
  }

  function initializeLegend() {
    if (!map || !isMapLoaded || !options.displayRaster()) return;
    const legend = options.legendOptions();
    if (!legend) {
      options.onInvalidLegend();
      return;
    }
    colorbar = new SkopeColorbar(legend);
    map.addControl(colorbar, options.legendPosition());
  }

  function reset(step: number) {
    removeCogRasterLayer();
    if (options.baseUrl()) addCogRasterLayer(step);
  }

  function updateLegend(legend: ColorbarOptions | null) {
    if (legend) colorbar?.update(legend);
  }

  function setLegendVisible(visible: boolean) {
    if (visible) colorbar?.show();
    else colorbar?.hide();
  }

  function dispose() {
    if (!map) return;
    map.off("error", handleError);
    removeCogRasterLayer();
    if (colorbar) {
      map.removeControl(colorbar);
      colorbar = null;
    }
    isMapLoaded = false;
    map = null;
  }

  return {
    initialize,
    initializeLegend,
    updateStep: updateRasterLayer,
    preloadStep,
    reset,
    updateLegend,
    setLegendVisible,
    dispose,
  };
}
