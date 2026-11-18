import type { SummaryStat } from "@/types/timeseries";
import { format } from "mathjs";

const DEFAULT_PRECISION = 2;

export function formatStats(
  summaryStats: readonly SummaryStat[],
  precision = DEFAULT_PRECISION,
) {
  return summaryStats.map((s) => ({
    name: s.name,
    stdev: format(s.stdev, { notation: "fixed", precision }),
    mean: format(s.mean, { notation: "fixed", precision }),
    median: format(s.median, { notation: "fixed", precision }),
  }));
}

export function toISODate(year: number) {
  return `${year.toString().padStart(4, "0")}-01-01`;
}

export function extractYear(isoDateString: string) {
  const year = parseInt(isoDateString.split("-")[0]!);
  return year;
}
