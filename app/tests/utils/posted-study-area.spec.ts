import { describe, expect, it } from "vitest";
import { parsePostedStudyArea } from "@/utils/postedStudyArea";

const point = {
  type: "Feature",
  properties: {},
  geometry: { type: "Point", coordinates: [-107.971802, 36.048799] },
};
const polygon = {
  type: "Polygon",
  coordinates: [
    [
      [-108, 36],
      [-107, 36],
      [-107, 37],
      [-108, 36],
    ],
  ],
};

describe("posted study areas", () => {
  it("accepts the original CyberSW curl body regardless of its Content-Type", () => {
    expect(parsePostedStudyArea(`studyArea=${JSON.stringify(point)}`)).toEqual(
      point,
    );
  });

  it("decodes a browser form without losing special characters in properties", () => {
    const feature = { ...point, properties: { name: "A+B & C </script>" } };
    const body = new URLSearchParams({ studyArea: JSON.stringify(feature) });
    expect(parsePostedStudyArea(body.toString())).toEqual(feature);
  });

  it.each([point, JSON.stringify(point)])(
    "accepts a JSON studyArea field (%j)",
    (studyArea) => {
      expect(parsePostedStudyArea(JSON.stringify({ studyArea }))).toEqual(
        point,
      );
    },
  );

  it("normalizes a polygon geometry and a single-feature collection", () => {
    expect(
      parsePostedStudyArea(JSON.stringify({ studyArea: polygon })),
    ).toEqual({
      type: "Feature",
      properties: {},
      geometry: polygon,
    });
    expect(
      parsePostedStudyArea(
        JSON.stringify({
          studyArea: {
            type: "FeatureCollection",
            features: [point],
          },
        }),
      ),
    ).toEqual(point);
  });

  it.each([
    "",
    "studyArea=oops",
    "{}",
    "studyArea=null",
    JSON.stringify({
      studyArea: {
        type: "FeatureCollection",
        features: [point, point],
      },
    }),
    JSON.stringify({ studyArea: { type: "Point", coordinates: [] } }),
  ])(
    "rejects missing, malformed, empty, or multiple study features (%s)",
    (body) => expect(() => parsePostedStudyArea(body)).toThrow(),
  );
});
