import { computed, onScopeDispose, ref, watch, type Ref } from "vue";
import { stepAlongAxis } from "@/utils/timeAxis";

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

  function scheduleNext() {
    clearTimeout(timer);
    if (!isPlaying.value || isLoading.value) return;
    const next = stepAlongAxis(
      years.value,
      displayedStep.value,
      1,
      range.value,
    );
    if (next === displayedStep.value) {
      pause();
      return;
    }
    timer = setTimeout(() => {
      requestedStep.value = next;
      readyStep.value = null;
    }, 4000);
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
      requestedStep.value = availableYears.value[0];
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
      selectStep(availableYears.value[0]);
    }
  });
  onScopeDispose(pause);

  return {
    requestedStep,
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
