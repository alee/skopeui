import { describe, expect, it } from "vitest";

import { TRANSFORM_OPTIONS } from "@/utils/analysisOptions";

// The analyze page's form, as the options read and write it.
function form(overrides: Record<string, unknown> = {}) {
  return {
    transformOption: "none",
    temporalRange: [103, 2000],
    timeRange: { lb: { year: 900, month: 1 }, ub: { year: 1100, month: 1 } },
    zScoreMovingIntervalTimeSteps: 25,
    ...overrides,
  } as any;
}

// The request's own time range: the range on screen.
const SHOWN = { gte: "0103-01-01", lte: "2000-01-01" };

function optionFor(transform: any, timeRange: any = SHOWN) {
  return TRANSFORM_OPTIONS.filter((option: any) =>
    option.matches(transform, timeRange),
  );
}

describe("TRANSFORM_OPTIONS", () => {
  it.each(TRANSFORM_OPTIONS.map((option: any) => [option.id, option]))(
    "maps %s's request back to the same option and form",
    (id, option: any) => {
      const transform = option.toRequestData(form());
      expect(optionFor(transform).map((o: any) => o.id)).toEqual([id]);

      const restored = form({
        timeRange: { lb: { year: 1, month: 1 }, ub: { year: 2, month: 1 } },
        zScoreMovingIntervalTimeSteps: 3,
      });
      option.fromRequestData(restored, transform);
      expect(restored.transformOption).toBe(id);
    },
  );

  it("uses the range on screen as the selected interval's reference", () => {
    const [zscoreSelected] = optionFor({
      type: "ZScoreFixedInterval",
      time_range: SHOWN,
    }) as any[];

    expect(zscoreSelected.id).toBe("zscoreSelected");
    expect(
      zscoreSelected.toRequestData(form({ temporalRange: [900, 1100] })),
    ).toEqual({
      type: "ZScoreFixedInterval",
      time_range: { gte: "0900-01-01", lte: "1100-01-01" },
    });
  });

  it("reads a saved z-score without a reference as the selected interval", () => {
    expect(
      optionFor({ type: "ZScoreFixedInterval" }).map((o: any) => o.id),
    ).toEqual(["zscoreSelected"]);
  });

  it("restores the fixed interval's years, not the request's dates", () => {
    const [zscoreFixed] = optionFor({
      type: "ZScoreFixedInterval",
      time_range: { gte: "0900-01-01", lte: "1100-01-01" },
    }) as any[];
    const restored = form({ timeRange: null });

    zscoreFixed.fromRequestData(restored, {
      type: "ZScoreFixedInterval",
      time_range: { gte: "0900-01-01", lte: "1100-01-01" },
    });

    expect(restored.timeRange).toEqual({
      lb: { year: 900, month: 1 },
      ub: { year: 1100, month: 1 },
    });
  });
});
