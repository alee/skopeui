<template>
  <div ref="container" class="plotly-client" />
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Plotly from "plotly.js/lib/core";
import Scatter from "plotly.js/lib/scatter";
import type { Data, Layout, Config } from "plotly.js";
import { stableJson } from "@/utils/extractionIdentity";

Plotly.register([Scatter]);

const props = defineProps<{
  data: Data[];
  layout?: Partial<Layout>;
  options?: Partial<Config>;
}>();

const emit = defineEmits<{
  (e: "click", payload: unknown): void;
  (e: "ready", ready: boolean): void;
}>();

type PlotContainer = HTMLDivElement & {
  data?: unknown[];
  layout?: Partial<Layout>;
};
const container = ref<PlotContainer | null>(null);
let renderVersion = 0;
let isReady = false;
let resizeObserver: ResizeObserver | null = null;
let resizeFrame: number | null = null;

async function renderPlot(
  data = props.data,
  layout = props.layout,
  options = props.options,
) {
  const target = container.value;
  if (!target) return;
  const version = ++renderVersion;
  isReady = false;
  emit("ready", false);
  try {
    await Plotly.react(target, data || [], layout || {}, options || {});
    if (container.value !== target || version !== renderVersion) return;
    isReady = true;
    emit("ready", true);
  } catch (error) {
    if (container.value === target && version === renderVersion)
      console.error("Unable to render plot", error);
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
  expectedData?: Array<{ name?: unknown; x?: unknown; y?: unknown }>,
): Promise<{ svg: string; png: string }> {
  if (!isReady || !container.value)
    throw new Error("The plot is not ready for export.");
  // Capture the rendered view, including user zoom and trace visibility. The
  // detached figures survive updates or disposal of the on-screen plot.
  const data = container.value.data as Array<{
    name?: unknown;
    x?: unknown;
    y?: unknown;
  }>;
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
  await renderPlot();
  if (!container.value) return;
  scheduleResize();

  if (container.value != null) {
    (container.value as any).on("plotly_click", (eventData: unknown) => {
      emit("click", eventData);
    });
  }

  if (typeof ResizeObserver !== "undefined" && container.value != null) {
    resizeObserver = new ResizeObserver(() => {
      scheduleResize();
    });
    resizeObserver.observe(container.value);

    if (container.value.parentElement != null) {
      resizeObserver.observe(container.value.parentElement);
    }
  }

  if (typeof window !== "undefined") {
    window.addEventListener("resize", scheduleResize);
  }
});

watch(
  () => [props.data, props.layout, props.options],
  async () => {
    await nextTick();
    await renderPlot();
    scheduleResize();
  },
  { deep: true },
);

onBeforeUnmount(() => {
  renderVersion++;
  isReady = false;
  emit("ready", false);
  resizeObserver?.disconnect();

  if (typeof window !== "undefined") {
    window.removeEventListener("resize", scheduleResize);
    if (resizeFrame != null) {
      window.cancelAnimationFrame(resizeFrame);
    }
  }

  if (container.value != null) {
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
