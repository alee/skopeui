import type { Time } from "@/types/metadata";

const STEP_LABELS: Record<string, string> = { P1Y: "annual" };

/** Presentation inputs, separate from the generated /metadata 1.0.0 types. */
export interface TemporalPresentationLabels {
  axis_label?: string | null;
  current_label?: string | null;
}

/**
 * Resolve wording independently of timestamp parsing and calendar semantics.
 * The UI currently plots annual axes; other precisions get neutral labels.
 * Callers use defaults until a versioned API contract supplies presentation
 * labels, which can then be passed as the second argument.
 */
export function resolveTemporalLabels(
  time: Pick<Time, "precision"> | null | undefined,
  presentation: TemporalPresentationLabels = {},
) {
  const annual = time?.precision === "year";
  return {
    axis: presentation.axis_label?.trim() || (annual ? "Year" : "Time"),
    current:
      presentation.current_label?.trim() ||
      (annual ? "Current year" : "Current time"),
  };
}

/** The year of a timestep key or ISO date: "0103" and "0103-01-01" are 103. */
export function yearOfTimestep(key: string): number {
  return Number(key.slice(0, 4));
}

/** The first and last years a dataset's time axis covers. */
export function timeSpan(time: Time): [number, number] {
  return [yearOfTimestep(time.origin), yearOfTimestep(time.end)];
}

/** A readable coverage label, such as "103–2000 CE, annual". */
export function timeCoverageLabel(time: Time): string {
  const [start, end] = timeSpan(time);
  const span = start === end ? `${start} CE` : `${start}–${end} CE`;
  const step = time.step ? STEP_LABELS[time.step] : undefined;
  return step ? `${span}, ${step}` : span;
}

// SKOPE UI reads annual axes, where a year identifies a timestep. Finer
// precisions and the static profile (PROTO-008) aren't supported yet.

/** The tile key of a year on an annual axis: 590 is "0590" (API-002). */
export function timestepKey(year: number): string {
  return String(year).padStart(4, "0");
}

/** Every year on the axis, in order. */
export function axisYears(time: Time): number[] {
  if (time.kind === "enumerated" && time.values) {
    return time.values.map(yearOfTimestep);
  }
  const [start, end] = timeSpan(time);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/**
 * The year `delta` timesteps from `year` along the axis, kept within
 * [lower, upper]. A year off the axis moves from the nearest one before it.
 */
export function stepAlongAxis(
  years: number[],
  year: number,
  delta: number,
  [lower, upper]: [number, number],
): number {
  const inRange = years.filter((y) => y >= lower && y <= upper);
  if (inRange.length === 0) return year;
  const before = inRange.filter((y) => y <= year).length - 1;
  const index = Math.min(Math.max(before + delta, 0), inRange.length - 1);
  return inRange[index]!;
}

/**
 * The timestep a typed year names within [lower, upper], or null when the
 * text isn't a year or falls outside the range. A year missing from the axis
 * moves to the nearest one before it.
 */
export function stepFromText(
  years: number[],
  text: string,
  [lower, upper]: [number, number],
): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,4}$/.test(trimmed)) return null;
  const year = Number(trimmed);
  if (year < lower || year > upper) return null;
  return stepAlongAxis(years, year, 0, [lower, upper]);
}
