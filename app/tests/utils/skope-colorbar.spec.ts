import { describe, expect, it } from "vitest";

import { SkopeColorbar, tickValues } from "@/utils/skopeColorbar";

function render(options: ConstructorParameters<typeof SkopeColorbar>[0]) {
  const colorbar = new SkopeColorbar(options);
  return colorbar.onAdd({} as any);
}

describe("tickValues", () => {
  it("spreads a tick count evenly over the range, top down", () => {
    expect(tickValues([0, 1807.5], 5)).toEqual([
      1807.5, 1355.625, 903.75, 451.875, 0,
    ]);
  });

  it("uses explicit ticks as given, top down", () => {
    expect(tickValues([0, 2200], [0, 1100, 2200, 550])).toEqual([
      2200, 1100, 550, 0,
    ]);
  });
});

describe("SkopeColorbar", () => {
  const colors = ["#B5834A", "#358C87"];

  it("labels the served range endpoints unchanged", () => {
    const labels = Array.from(
      render({
        colors,
        range: [0, 1807.5],
        ticks: 5,
        units: "mm",
      }).querySelectorAll("text"),
      (text) => text.textContent,
    );

    expect(labels[0]).toBe("1807.5");
    expect(labels.at(-1)).toBe("0");
  });

  it("labels explicit ticks as round numbers", () => {
    const labels = Array.from(
      render({
        colors,
        range: [0, 2200],
        ticks: [0, 550, 1100, 1650, 2200],
      }).querySelectorAll("text"),
      (text) => text.textContent,
    );

    expect(labels).toEqual(["2200", "1650", "1100", "550", "0"]);
  });

  it("shows the unit above the bar", () => {
    const container = render({ colors, range: [0, 1], ticks: 2, units: "mm" });

    expect(container.querySelector(".skope-colorbar__units")?.textContent).toBe(
      "Units: mm",
    );
  });
});
