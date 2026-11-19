import { describe, expect, it } from "vitest";
import {
  analysisFormFromRequest,
  analysisOptionsFromForm,
  defaultAnalysisForm,
  transformOptionFor,
  TRANSFORM_OPTIONS,
} from "@/utils/analysisOptions";

const SHOWN = { gte: "0103-01-01", lte: "2000-01-01" };
describe("analysis form conversion", () => {
  it.each(TRANSFORM_OPTIONS)("round trips $id", ({ id }) => {
    const form = { ...defaultAnalysisForm(), transformOption: id };
    const options = analysisOptionsFromForm(form, [103, 2000]);
    expect(transformOptionFor(options.transform, SHOWN)).toBe(id);
    expect(
      analysisFormFromRequest(defaultAnalysisForm(), {
        ...options,
        time_range: SHOWN,
      }).transformOption,
    ).toBe(id);
  });
  it("sends the selected interval explicitly and reads legacy references", () => {
    expect(
      analysisOptionsFromForm(
        { ...defaultAnalysisForm(), transformOption: "zscoreSelected" },
        [900, 1100],
      ).transform,
    ).toEqual({
      type: "ZScoreFixedInterval",
      time_range: { gte: "0900-01-01", lte: "1100-01-01" },
    });
    expect(transformOptionFor({ type: "ZScoreFixedInterval" }, SHOWN)).toBe(
      "zscoreSelected",
    );
  });
  it("restores fixed years and active widths while retaining inactive drafts", () => {
    const draft = defaultAnalysisForm();
    draft.smoothingTimeStep = "19";
    draft.zScoreMovingIntervalTimeSteps = "37";
    const result = analysisFormFromRequest(draft, {
      transform: {
        type: "ZScoreFixedInterval",
        time_range: { gte: "0900-01-01", lte: "1100-01-01" },
      },
      time_range: SHOWN,
      requested_series_options: [
        { name: "Original", smoother: { type: "NoSmoother" } },
      ],
    });
    expect(result.timeRange).toEqual({
      lb: { year: 900, month: 1 },
      ub: { year: 1100, month: 1 },
    });
    expect(result.smoothingTimeStep).toBe("19");
    expect(result.zScoreMovingIntervalTimeSteps).toBe("37");
    expect(draft.timeRange.lb.year).toBe(1500);
  });
  it.each(["centeredAverage", "trailingAverage"] as const)(
    "normalizes raw widths for %s without modifying the draft",
    (smoothingOption) => {
      const form = {
        ...defaultAnalysisForm(),
        smoothingOption,
        smoothingTimeStep: "19",
        transformOption: "zscoreMoving" as const,
        zScoreMovingIntervalTimeSteps: "37",
      };
      const options = analysisOptionsFromForm(form, [103, 2000]);
      expect(options.transform).toEqual({
        type: "ZScoreMovingInterval",
        width: 37,
      });
      expect(options.requested_series_options[1]?.smoother).toEqual({
        type: "MovingAverageSmoother",
        method: smoothingOption === "centeredAverage" ? "centered" : "trailing",
        width: 19,
      });
      expect(
        analysisFormFromRequest(defaultAnalysisForm(), options).smoothingOption,
      ).toBe(smoothingOption);
      expect(form.smoothingTimeStep).toBe("19");
    },
  );
  it("clears an applied smoother when loading an unsmoothed request", () => {
    expect(
      analysisFormFromRequest(
        { ...defaultAnalysisForm(), smoothingOption: "centeredAverage" },
        {
          requested_series_options: [
            { name: "Original", smoother: { type: "NoSmoother" } },
          ],
        },
      ).smoothingOption,
    ).toBe("none");
  });
});
