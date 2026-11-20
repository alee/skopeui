import { effectScope, nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRasterPlayback } from "@/composables/useRasterPlayback";

describe("raster playback", () => {
  let scope: ReturnType<typeof effectScope>;
  const setup = (initial = 103) => {
    const years = ref([103, 104, 106]);
    const range = ref<[number, number]>([103, 106]);
    const playback = scope.run(() => useRasterPlayback(years, range, initial))!;
    return { ...playback, range };
  };
  beforeEach(() => {
    scope = effectScope();
    vi.useFakeTimers();
  });
  afterEach(() => {
    scope.stop();
    vi.useRealTimers();
  });

  it("waits for the requested raster and holds it for two seconds", () => {
    const p = setup();
    p.togglePlay();
    vi.advanceTimersByTime(5000);
    expect(p.requestedStep.value).toBe(103);
    p.frameReady(103);
    vi.advanceTimersByTime(1999);
    expect(p.requestedStep.value).toBe(103);
    vi.advanceTimersByTime(1);
    expect(p.requestedStep.value).toBe(104);
    expect(p.displayedStep.value).toBe(103);
    vi.advanceTimersByTime(5000);
    expect(p.requestedStep.value).toBe(104);
    p.frameReady(104);
    expect(p.displayedStep.value).toBe(104);
    vi.advanceTimersByTime(2000);
    expect(p.requestedStep.value).toBe(106);
    p.frameReady(106);
    expect(p.isPlaying.value).toBe(false);
  });

  it("preloads one year ahead only during a ready frame's hold", async () => {
    const p = setup();
    expect(p.preloadStep.value).toBeNull();
    p.togglePlay();
    expect(p.preloadStep.value).toBeNull();
    p.frameReady(103);
    expect(p.preloadStep.value).toBe(104);
    vi.advanceTimersByTime(2000);
    expect(p.requestedStep.value).toBe(104);
    expect(p.preloadStep.value).toBeNull();
    p.frameReady(104);
    expect(p.preloadStep.value).toBe(106);
    p.pause();
    expect(p.preloadStep.value).toBeNull();
    p.togglePlay();
    p.range.value = [103, 104];
    await nextTick();
    expect(p.preloadStep.value).toBeNull();
    p.frameReady(106);
    expect(p.preloadStep.value).toBeNull();
  });

  it("restarts at the first year when Play is pressed at the end", () => {
    const p = setup(106);
    p.frameReady(106);
    p.togglePlay();
    expect(p.requestedStep.value).toBe(103);
    expect(p.displayedStep.value).toBe(106);
    expect(p.isPlaying.value).toBe(true);
  });

  it("ignores completion of a superseded frame", () => {
    const p = setup();
    p.selectStep(106);
    p.frameReady(104);
    expect(p.displayedStep.value).toBe(103);
    expect(p.isLoading.value).toBe(true);
    p.frameReady(106);
    expect(p.displayedStep.value).toBe(106);
  });

  it("manual selection cancels the next automatic step", () => {
    const p = setup();
    p.frameReady(103);
    p.togglePlay();
    p.selectStep(106);
    vi.advanceTimersByTime(5000);
    expect(p.requestedStep.value).toBe(106);
    expect(p.isPlaying.value).toBe(false);
  });

  it("range changes pause playback and keep requests inside the range", async () => {
    const p = setup();
    p.frameReady(103);
    p.togglePlay();
    p.range.value = [104, 106];
    await nextTick();
    vi.advanceTimersByTime(5000);
    expect(p.isPlaying.value).toBe(false);
    expect(p.requestedStep.value).toBe(104);
  });

  it("pausing while loading prevents completion from restarting playback", () => {
    const p = setup();
    p.togglePlay();
    p.pause();
    p.frameReady(103);
    vi.advanceTimersByTime(5000);
    expect(p.requestedStep.value).toBe(103);
  });

  it("leaving the page clears the pending advance", () => {
    const p = setup();
    p.frameReady(103);
    p.togglePlay();
    scope.stop();
    vi.advanceTimersByTime(5000);
    expect(p.requestedStep.value).toBe(103);
  });
});
