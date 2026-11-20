import { describe, expect, it } from "vitest";
import { parseImportedStudyArea } from "@/utils/studyArea";

const point = { type: "Point", coordinates: [-108, 37] };
const ring = [
  [-109, 36],
  [-108, 36],
  [-108, 37],
  [-109, 36],
];
const polygon = { type: "Polygon", coordinates: [ring] };

describe("study-area imports", () => {
  it.each([point, polygon])(
    "wraps a valid %j geometry as one feature",
    (geometry) => {
      expect(parseImportedStudyArea(geometry)).toEqual({
        type: "Feature",
        properties: {},
        geometry,
      });
    },
  );

  it("preserves feature metadata and unwraps a one-feature collection", () => {
    const feature = {
      type: "Feature",
      properties: { name: "Study area" },
      geometry: point,
    };
    expect(parseImportedStudyArea(feature)).toEqual(feature);
    expect(
      parseImportedStudyArea({
        type: "FeatureCollection",
        features: [feature],
      }),
    ).toEqual(feature);
  });

  it("accepts a polygon with a closed interior ring", () => {
    const geometry = {
      ...polygon,
      coordinates: [
        ring,
        [
          [-108.8, 36.2],
          [-108.6, 36.2],
          [-108.6, 36.3],
          [-108.8, 36.2],
        ],
      ],
    };
    expect(parseImportedStudyArea(geometry)).toEqual(
      expect.objectContaining({ geometry }),
    );
  });

  it.each([
    null,
    {},
    [],
    { type: "Feature", geometry: null },
    { type: "FeatureCollection", features: [] },
    { type: "FeatureCollection", features: [point] },
    {
      type: "FeatureCollection",
      features: [
        { type: "Feature", geometry: point },
        { type: "Feature", geometry: point },
      ],
    },
    {
      type: "LineString",
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    },
    { type: "Point", coordinates: [] },
    { type: "Point", coordinates: [181, 0] },
    { type: "Point", coordinates: [0, -91] },
    { type: "Point", coordinates: [NaN, 0] },
    { type: "Point", coordinates: [0, Infinity] },
    { type: "Point", coordinates: ["0", 0] },
    { type: "Polygon", coordinates: [] },
    { type: "Polygon", coordinates: [ring.slice(0, 3)] },
    { type: "Polygon", coordinates: [[...ring.slice(0, 3), [-110, 36]]] },
    { type: "Polygon", coordinates: [ring, []] },
    {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0],
        ],
      ],
    },
  ])("rejects invalid or unsupported geometry: %j", (input) => {
    expect(() => parseImportedStudyArea(input)).toThrow();
  });
});
