import { expect, it } from "vitest";
import { hasStudyArea } from "@/utils/studyArea";

it.each([
  null,
  false,
  "old data",
  {},
  { type: "FeatureCollection", features: [] },
  { type: "FeatureCollection" },
  { type: "Feature", geometry: null },
  { type: "Point", coordinates: [] },
  { type: "Polygon", coordinates: [[]] },
  { type: "Point", coordinates: [NaN, 0] },
])("does not count an empty or invalid saved value as an area: %j", (area) => {
  expect(hasStudyArea(area)).toBe(false);
});

it.each([
  { type: "Point", coordinates: [-108.5, 37] },
  { type: "Feature", geometry: { type: "Point", coordinates: [0, 0] } },
  {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
        },
      },
    ],
  },
])("recognizes an existing drawable area: %j", (area) => {
  expect(hasStudyArea(area)).toBe(true);
});
