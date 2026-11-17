import Ajv2020 from "ajv/dist/2020";
import schema from "@/contracts/timeseries.schema.json";
import type { TimeseriesRequest, TimeRange } from "@/types/timeseries";
import type { SavedAnalysisRequest } from "@/types/api";
import type { Dataset } from "@/types/metadata";
import { defaultAnalysisOptions } from "@/types/api";
import { axisYears, timeSpan } from "@/utils/timeAxis";

// OpenAPI's discriminator is an annotation here; oneOf enforces the variants.
const validate = new Ajv2020({
  allErrors: true,
  strict: false,
  strictNumbers: true,
}).compile<TimeseriesRequest>({
  $schema: schema.$schema,
  $defs: schema.$defs,
  $ref: "#/$defs/TimeseriesRequest",
});

export class SavedAnalysisValidationError extends Error {}
function invalid(message: string): never {
  throw new SavedAnalysisValidationError(message);
}

/** Validate a detached JSON snapshot; never coerce input or mutate its source. */
export function parseTimeseriesRequest(input: unknown): TimeseriesRequest {
  if (!input || typeof input !== "object" || Array.isArray(input))
    invalid("The saved request must be a JSON object.");
  const candidate: unknown = {
    ...defaultAnalysisOptions(),
    ...JSON.parse(JSON.stringify(input)),
  };
  if (!validate(candidate)) {
    const details = validate.errors
      ?.slice(0, 3)
      .map((error) => `${error.instancePath || "/"} ${error.message}`)
      .join("; ");
    invalid(`Invalid request: ${details}`);
  }
  if (
    !candidate.transform.type ||
    candidate.requested_series_options.some((option) => !option.smoother.type)
  ) {
    invalid("Every transform and smoother must identify its type.");
  }
  // Like the backend, ignore unknown top-level fields. Do not store arbitrary
  // file contents in application state.
  const {
    dataset_id,
    variable_id,
    selected_area,
    time_range,
    zonal_statistic,
    transform,
    requested_series_options,
    max_processing_time,
  } = candidate;
  return {
    dataset_id,
    variable_id,
    selected_area,
    time_range,
    zonal_statistic,
    transform,
    requested_series_options,
    max_processing_time,
  };
}

function year(key: string): number {
  const parts = key.match(
    /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:Z|[+-](\d{2}):(\d{2}))?)?)?)?$/,
  );
  if (!parts) invalid("Use ISO dates for the time range.");
  const [y, month, day, hour, minute, second, zoneHour, zoneMinute] = parts
    .slice(1)
    .map((part) => (part === undefined ? undefined : Number(part)));
  const m = month ?? 1;
  const leap = y! % 4 === 0 && (y! % 100 !== 0 || y! % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    !y ||
    m < 1 ||
    m > 12 ||
    (day ?? 1) < 1 ||
    (day ?? 1) > days[m - 1] ||
    (hour ?? 0) > 23 ||
    (minute ?? 0) > 59 ||
    (second ?? 0) > 59 ||
    (zoneHour ?? 0) > 23 ||
    (zoneMinute ?? 0) > 59
  ) {
    invalid("The time range contains an invalid calendar date.");
  }
  return y;
}

function rangeYears(range: TimeRange): [number, number] {
  const bounds: [number, number] = [year(range.gte), year(range.lte)];
  if (range.gte > range.lte)
    invalid("The start of the time range must not follow its end.");
  return bounds;
}

function singleGeometry(area: TimeseriesRequest["selected_area"]) {
  if (area.type === "FeatureCollection") {
    if (area.features.length !== 1)
      invalid("Select exactly one study feature.");
    return area.features[0].geometry;
  }
  return area.type === "Feature" ? area.geometry : area;
}

export function parseSavedAnalysis(input: unknown): SavedAnalysisRequest {
  const request = parseTimeseriesRequest(input);
  if (!request.time_range)
    invalid("The saved analysis must include a time range.");
  rangeYears(request.time_range);
  if (
    request.transform.type === "ZScoreFixedInterval" &&
    request.transform.time_range
  )
    rangeYears(request.transform.time_range);
  const geometry = singleGeometry(request.selected_area);
  if (!geometry || (geometry.type !== "Point" && geometry.type !== "Polygon"))
    invalid("The study area must be one point or polygon.");
  if (geometry.type === "Polygon") {
    if (!geometry.coordinates.length) invalid("The study polygon is empty.");
    for (const ring of geometry.coordinates) {
      if (
        ring.length < 4 ||
        JSON.stringify(ring[0]) !== JSON.stringify(ring[ring.length - 1])
      )
        invalid(
          "Each polygon ring must be closed and contain at least four positions.",
        );
    }
  }
  const names = new Set<string>();
  for (const option of request.requested_series_options) {
    if (names.has(option.name)) invalid("Series names must be unique.");
    names.add(option.name);
    if (
      option.smoother.type === "MovingAverageSmoother" &&
      option.smoother.method === "centered" &&
      option.smoother.width % 2 === 0
    )
      invalid("Centered smoothing requires an odd window width.");
  }
  return { ...request, time_range: request.time_range };
}

/** Validate against fresh metadata before any selected dataset or area changes. */
export function validateSavedAnalysisDataset(
  request: SavedAnalysisRequest,
  dataset: Dataset | undefined,
): asserts dataset is Dataset {
  if (
    !dataset ||
    !dataset.variables.some((variable) => variable.id === request.variable_id)
  )
    invalid(
      "Unable to initialize the saved analysis: its dataset or variable is unavailable.",
    );
  if (dataset.time.precision !== "year")
    invalid("This interface supports annual datasets only.");
  const [start, end] = rangeYears(request.time_range);
  const [minimum, maximum] = timeSpan(dataset.time);
  if (
    start < minimum ||
    end > maximum ||
    !axisYears(dataset.time).some((step) => step >= start && step <= end)
  )
    invalid(
      "The saved time range must select timesteps within the dataset's coverage.",
    );
  if (
    request.transform.type === "ZScoreMovingInterval" &&
    request.transform.width >= dataset.time.count
  )
    invalid("The z-score window must be shorter than the dataset.");
  if (
    request.requested_series_options.some(
      (option) =>
        option.smoother.type === "MovingAverageSmoother" &&
        option.smoother.width > dataset.time.count,
    )
  )
    invalid("The smoothing window must fit within the dataset.");
}
