// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generateTimeseriesTypes } from "@/scripts/timeseries-types.mjs";
import {
  parseSavedAnalysis,
  parseTimeseriesRequest,
  validateSavedAnalysisDataset,
} from "@/utils/savedAnalysis";
import metadata from "@/tests/fixtures/metadata-1.0.0.json";
import type { Dataset } from "@/types/metadata";

const savedRequest = {
  dataset_id: "paleocar_v3",
  variable_id: "ppt_annual",
  selected_area: { type: "Point", coordinates: [-108, 37] },
  time_range: { gte: "1500", lte: "1600" },
};
const dataset = metadata.datasets[0] as Dataset;

describe("time-series contract", () => {
  it("keeps generated request and result types synchronized with the backend schema snapshot", async () => {
    expect(
      readFileSync(resolve(__dirname, "../../types/timeseries.ts"), "utf8"),
    ).toBe(await generateTimeseriesTypes());
  });

  it("retains the raw saved-request format and supplies neutral options for older files", () => {
    const parsed = parseSavedAnalysis(savedRequest);
    expect(parsed).toMatchObject({
      ...savedRequest,
      zonal_statistic: "mean",
      transform: { type: "NoTransform" },
      requested_series_options: [
        { name: "Original", smoother: { type: "NoSmoother" } },
      ],
    });
    expect(() => validateSavedAnalysisDataset(parsed, dataset)).not.toThrow();
    expect(savedRequest).not.toHaveProperty("transform");
  });

  it("copies input before using it and drops unknown top-level fields", () => {
    const input = { ...savedRequest, internal_state: "ignore" };
    const parsed = parseSavedAnalysis(input);
    expect(parsed).not.toHaveProperty("internal_state");
    parsed.selected_area.type = "Polygon" as any;
    expect(input.selected_area.type).toBe("Point");
  });

  it.each([
    ["null", null],
    ["array", []],
    ["missing dataset", { ...savedRequest, dataset_id: undefined }],
    ["non-string identifier", { ...savedRequest, variable_id: 3 }],
    ["null geometry", { ...savedRequest, selected_area: null }],
    [
      "non-numeric coordinate",
      {
        ...savedRequest,
        selected_area: { type: "Point", coordinates: ["-108", 37] },
      },
    ],
    [
      "infinite coordinate",
      {
        ...savedRequest,
        selected_area: { type: "Point", coordinates: [Infinity, 37] },
      },
    ],
    ["unknown transform", { ...savedRequest, transform: { type: "Other" } }],
    ["missing transform tag", { ...savedRequest, transform: {} }],
    [
      "fractional window",
      {
        ...savedRequest,
        transform: { type: "ZScoreMovingInterval", width: 2.5 },
      },
    ],
    ["invalid statistic", { ...savedRequest, zonal_statistic: "sum" }],
    ["empty series options", { ...savedRequest, requested_series_options: [] }],
    ["null options", { ...savedRequest, requested_series_options: null }],
    [
      "invalid processing deadline",
      { ...savedRequest, max_processing_time: -1 },
    ],
    ["no range", { ...savedRequest, time_range: null }],
    [
      "reversed range",
      { ...savedRequest, time_range: { gte: "1600", lte: "1500" } },
    ],
    [
      "invalid calendar date",
      { ...savedRequest, time_range: { gte: "1500-02-29", lte: "1600" } },
    ],
    [
      "invalid month",
      { ...savedRequest, time_range: { gte: "1500-13", lte: "1600" } },
    ],
    [
      "year zero",
      { ...savedRequest, time_range: { gte: "0000", lte: "1600" } },
    ],
    [
      "empty collection",
      {
        ...savedRequest,
        selected_area: { type: "FeatureCollection", features: [] },
      },
    ],
    [
      "null feature geometry",
      {
        ...savedRequest,
        selected_area: { type: "Feature", properties: {}, geometry: null },
      },
    ],
    [
      "unsupported shape",
      {
        ...savedRequest,
        selected_area: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [0, 0],
              [1, 1],
            ],
          },
        },
      },
    ],
    [
      "open ring",
      {
        ...savedRequest,
        selected_area: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
            ],
          ],
        },
      },
    ],
  ])("rejects %s", (_description, input) => {
    expect(() => parseSavedAnalysis(input)).toThrow();
  });

  it("keeps nullable API ranges distinct from the saved-file requirement", () => {
    expect(
      parseTimeseriesRequest({ ...savedRequest, time_range: null }).time_range,
    ).toBeNull();
  });

  it("accepts a single polygon feature and a valid centered smoother", () => {
    const geometry = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    };
    const parsed = parseSavedAnalysis({
      ...savedRequest,
      selected_area: {
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: {}, geometry }],
      },
      requested_series_options: [
        {
          name: "Smoothed",
          smoother: {
            type: "MovingAverageSmoother",
            method: "centered",
            width: 3,
          },
        },
      ],
    });
    expect(parsed.requested_series_options[0].name).toBe("Smoothed");
  });

  it("rejects multiple study features", () => {
    const feature = {
      type: "Feature",
      properties: {},
      geometry: savedRequest.selected_area,
    };
    expect(() =>
      parseSavedAnalysis({
        ...savedRequest,
        selected_area: {
          type: "FeatureCollection",
          features: [feature, feature],
        },
      }),
    ).toThrow("exactly one");
  });

  it("checks duplicate series names and the centered window parity", () => {
    const option = { name: "Original", smoother: { type: "NoSmoother" } };
    expect(() =>
      parseSavedAnalysis({
        ...savedRequest,
        requested_series_options: [option, option],
      }),
    ).toThrow("unique");
    expect(() =>
      parseSavedAnalysis({
        ...savedRequest,
        requested_series_options: [
          {
            name: "Smoothed",
            smoother: {
              type: "MovingAverageSmoother",
              method: "centered",
              width: 2,
            },
          },
        ],
      }),
    ).toThrow("odd");
  });

  it("checks source availability, time coverage, and dataset-specific window bounds", () => {
    const parsed = parseSavedAnalysis(savedRequest);
    expect(() => validateSavedAnalysisDataset(parsed, undefined)).toThrow(
      "unavailable",
    );
    expect(() =>
      validateSavedAnalysisDataset(
        { ...parsed, variable_id: "missing" },
        dataset,
      ),
    ).toThrow("unavailable");
    expect(() =>
      validateSavedAnalysisDataset(
        { ...parsed, time_range: { gte: "0001", lte: "1500" } },
        dataset,
      ),
    ).toThrow("coverage");
    expect(() =>
      validateSavedAnalysisDataset(
        {
          ...parsed,
          transform: {
            type: "ZScoreMovingInterval",
            width: dataset.time.count,
          },
        },
        dataset,
      ),
    ).toThrow("shorter");
  });
});
