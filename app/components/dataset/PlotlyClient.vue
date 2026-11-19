<template>
  <div ref="container" class="plotly-client" />
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Plotly from "plotly.js/lib/core";
import Scatter from "plotly.js/lib/scatter";
import type { Data, Layout, Config, Shape } from "plotly.js";
import type { PlotImageApi, ExportTrace } from "@/types/plot";
import { stableJson } from "@/utils/extractionIdentity";

Plotly.register([Scatter]);

const props = defineProps<{
  data: Data[];
  layout?: Partial<Layout>;
  options?: Partial<Config>;
  shapes?: Partial<Shape>[];
}>();

const emit = defineEmits<{
  (e: "click", payload: unknown): void;
  (e: "ready", ready: boolean): void;
  (e: "api-ready", api: PlotImageApi | null): void;
}>();

type PlotContainer = HTMLDivElement & {
  data?: unknown[];
  layout?: Partial<Layout>;
  on?: (event: "plotly_click", handler: (payload: unknown) => void) => void;
};
const container = ref<PlotContainer | null>(null);
let disposed = false;
let mounted = false;
let updating = false;
let pendingRender = false;
let pendingShapes = false;
let isReady = false;
let resizeObserver: ResizeObserver | null = null;
let resizeFrame: number | null = null;

// Plotly mutates its inputs. Keep those mutations out of Vue's reactive props.
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function requestUpdate(full: boolean) {
  pendingRender ||= full;
  pendingShapes = true;
  isReady = false;
  emit("ready", false);
  if (mounted) void updatePlot();
}

// Serialize Plotly work and coalesce changes received during an update.
async function updatePlot() {
  const target = container.value;
  if (!target || updating || disposed) return;
  updating = true;
  try {
    while (!disposed && (pendingRender || pendingShapes)) {
      const full = pendingRender;
      pendingRender = pendingShapes = false;
      if (full) {
        await Plotly.react(
          target,
          clone(props.data),
          clone({
            ...props.layout,
            shapes: props.shapes ?? props.layout?.shapes ?? [],
          }),
          clone(props.options ?? {}),
        );
        if (!disposed) scheduleResize();
      } else {
        await Plotly.relayout(target, { shapes: clone(props.shapes ?? []) });
      }
    }
    if (!disposed) {
      isReady = true;
      emit("ready", true);
    }
  } catch (error) {
    if (!disposed) console.error("Unable to render plot", error);
  } finally {
    updating = false;
    if (disposed) Plotly.purge(target);
    else if (pendingRender || pendingShapes) void updatePlot();
  }
}

function scheduleResize() {
  if (typeof window === "undefined" || container.value == null) {
    return;
  }

  if (resizeFrame != null) {
    window.cancelAnimationFrame(resizeFrame);
  }

  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = null;

    if (container.value == null) {
      return;
    }

    if (
      container.value.clientWidth === 0 ||
      container.value.clientHeight === 0
    ) {
      return;
    }

    void Plotly.Plots.resize(container.value);
  });
}

async function toImages(
  expectedData?: ExportTrace[],
): Promise<{ svg: string; png: string }> {
  if (!isReady || pendingRender || pendingShapes || !container.value)
    throw new Error("The plot is not ready for export.");
  // Capture the rendered view, including user zoom and trace visibility. The
  // detached figures survive updates or disposal of the on-screen plot.
  const data = (container.value.data ?? []) as ExportTrace[];
  const identity = (traces: typeof data) =>
    traces.map(({ name, x, y }) => ({ name, x, y }));
  if (
    expectedData &&
    stableJson(identity(data)) !== stableJson(identity(expectedData))
  )
    throw new Error("The plot does not match the analysis being exported.");
  const figure = JSON.stringify({
    data,
    layout: container.value.layout,
    config: props.options,
  });
  const svg = await Plotly.toImage(JSON.parse(figure), {
    format: "svg",
    height: 600,
    width: 1200,
  });
  const png = await Plotly.toImage(JSON.parse(figure), {
    format: "png",
    height: 600,
    width: 1200,
  });
  return { svg, png };
}

defineExpose({ toImages });

onMounted(async () => {
  await nextTick();
  if (disposed) return;
  mounted = true;
  emit("api-ready", { toImages });
  pendingRender = pendingShapes = true;
  await updatePlot();
  if (disposed) return;
  container.value?.on?.("plotly_click", (payload) => emit("click", payload));
  if (typeof ResizeObserver !== "undefined" && container.value != null) {
    resizeObserver = new ResizeObserver(() => {
      scheduleResize();
    });
    resizeObserver.observe(container.value);

    if (container.value.parentElement != null) {
      resizeObserver.observe(container.value.parentElement);
    }
  }

  if (!resizeObserver) window.addEventListener("resize", scheduleResize);
});

watch(
  () => [props.data, props.layout, props.options],
  () => requestUpdate(true),
);
watch(
  () => props.shapes,
  () => requestUpdate(false),
);

onBeforeUnmount(() => {
  disposed = true;
  emit("api-ready", null);
  isReady = false;
  emit("ready", false);
  resizeObserver?.disconnect();

  if (typeof window !== "undefined") {
    window.removeEventListener("resize", scheduleResize);
    if (resizeFrame != null) {
      window.cancelAnimationFrame(resizeFrame);
    }
  }

  if (container.value != null && !updating) {
    Plotly.purge(container.value);
  }
});
</script>

<style scoped>
/* Its parent sets the height. */
.plotly-client {
  width: 100%;
}
</style>
