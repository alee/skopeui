import { computed, onScopeDispose, ref, watch, type Ref } from "vue";
import { stepAlongAxis } from "@/utils/timeAxis";

const FRAME_HOLD_MS = 2000;

/** One requested frame at a time; the map acknowledges the year it rendered. */
export function useRasterPlayback(
  years: Ref<number[]>,
  range: Ref<[number, number]>,
  initialStep: number,
) {
  const requestedStep = ref(initialStep);
  const displayedStep = ref(initialStep);
  const readyStep = ref<number | null>(null);
  const isPlaying = ref(false);
  const isLoading = computed(() => readyStep.value !== requestedStep.value);
  const availableYears = computed(() =>
    years.value.filter(
      (year) => year >= range.value[0] && year <= range.value[1],
    ),
  );
  const canPlay = computed(() => availableYears.value.length > 1);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function pause() {
    isPlaying.value = false;
    clearTimeout(timer);
  }

  const nextStep = computed(() =>
    stepAlongAxis(years.value, displayedStep.value, 1, range.value),
  );
  // Only speculate while the current frame is ready and playback is active.
  const preloadStep = computed(() =>
    isPlaying.value &&
    !isLoading.value &&
    nextStep.value !== displayedStep.value
      ? nextStep.value
      : null,
  );

  function scheduleNext() {
    clearTimeout(timer);
    if (!isPlaying.value || isLoading.value) return;
    const next = nextStep.value;
    if (next === displayedStep.value) {
      pause();
      return;
    }
    timer = setTimeout(() => {
      requestedStep.value = next;
      readyStep.value = null;
    }, FRAME_HOLD_MS);
  }

  function frameReady(step: number) {
    if (step !== requestedStep.value) return;
    displayedStep.value = step;
    readyStep.value = step;
    scheduleNext();
  }

  function selectStep(step: number) {
    pause();
    if (step !== requestedStep.value) readyStep.value = null;
    requestedStep.value = step;
  }

  function togglePlay() {
    if (isPlaying.value) return pause();
    if (!canPlay.value) return;
    if (requestedStep.value >= availableYears.value.at(-1)!) {
      requestedStep.value = availableYears.value[0]!;
      readyStep.value = null;
    }
    isPlaying.value = true;
    scheduleNext();
  }

  watch([years, range], () => {
    pause();
    if (
      !availableYears.value.includes(requestedStep.value) &&
      availableYears.value.length
    ) {
      selectStep(availableYears.value[0]!);
    }
  });
  onScopeDispose(pause);

  return {
    requestedStep,
    preloadStep,
    displayedStep,
    isPlaying,
    isLoading,
    canPlay,
    frameReady,
    selectStep,
    togglePlay,
    pause,
  };
}
