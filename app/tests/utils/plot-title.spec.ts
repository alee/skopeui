import { describe, expect, it } from "vitest";

import { wrapPlotTitle, wrapPlotLabel } from "@/utils/plotTitle";

describe("wrapPlotTitle", () => {
  it("keeps a short title on one line", () => {
    expect(wrapPlotTitle("Water-year (Oct–Sept) Precipitation (mm)", 44)).toBe(
      "Water-year (Oct–Sept) Precipitation (mm)",
    );
  });

  it("splits a long title at the space nearest its middle", () => {
    expect(
      wrapPlotTitle(
        "Water-year (Oct–Sept) Cotton Growing Degree Days (°C GDD)",
        44,
      ),
    ).toBe("Water-year (Oct–Sept) Cotton<br>Growing Degree Days (°C GDD)");
  });

  it("keeps a long title with no space on one line", () => {
    expect(wrapPlotTitle("a".repeat(50), 44)).toBe("a".repeat(50));
  });
});

describe("narrow plot labels", () => {
  it("wraps the value title into lines that fit the available width", () => {
    const title = "Annual (Jan–Dec) Precipitation (mm)";
    const lines = wrapPlotLabel(title, 20).split("<br>");
    expect(lines.join(" ")).toBe(title);
    expect(lines.every((line) => line.length <= 20)).toBe(true);
  });

  it("preserves long identifiers while breaking them to fit", () => {
    const title = "X".repeat(70);
    const lines = wrapPlotLabel(title, 20).split("<br>");
    expect(lines.join("")).toBe(title);
    expect(lines.every((line) => line.length <= 20)).toBe(true);
  });
});
