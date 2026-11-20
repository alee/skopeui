import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  reportGeometry,
  reportJson,
  sendBugReport,
  withoutStudyArea,
  validReportScreenshot,
  MAX_SCREENSHOT_BYTES,
} from "@/utils/bugReport";
import {
  recordRequestDiagnostic,
  requestDiagnostics,
} from "@/utils/requestDiagnostics";

const sdk = vi.hoisted(() => ({
  hook: undefined as
    | undefined
    | ((event: { event_id: string }, response: { statusCode: number }) => void),
  status: 200,
  respond: true,
  capture: vi.fn(),
  close: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock("@sentry/nuxt", () => ({
  BrowserClient: class {
    init() {}
    on(_hook: string, callback: typeof sdk.hook) {
      sdk.hook = callback;
      return sdk.unsubscribe;
    }
    close() {
      sdk.close();
      return Promise.resolve(true);
    }
  },
  Scope: class {
    setClient() {}
    addEventProcessor() {}
  },
  defaultStackParser: vi.fn(),
  makeFetchTransport: vi.fn(),
  captureFeedback(params: unknown, hint: { event_id: string }) {
    sdk.capture(params, hint);
    if (sdk.respond)
      queueMicrotask(() =>
        sdk.hook?.({ event_id: hint.event_id }, { statusCode: sdk.status }),
      );
    return hint.event_id;
  },
}));
const report = {
  dsn: "https://public@example.com/1",
  message: "The plot looks wrong",
  email: "",
  diagnostics: "{}",
  buildId: "abc123",
  page: "https://staging.openskope.org/",
};
beforeEach(() => {
  vi.clearAllMocks();
  sdk.status = 200;
  sdk.respond = true;
});
afterEach(() => vi.useRealTimers());

describe("bug report privacy and delivery", () => {
  it("excludes geometry completely when unchecked, including request settings", () => {
    const geometry = { type: "Point", coordinates: [12.34567, 45.6789] };
    const snapshot = {
      studyArea: geometry,
      analysisSettings: withoutStudyArea({
        selected_area: geometry,
        dataset_id: "known",
        transform: { type: "NoTransform" },
      }),
    };
    const json = reportJson(snapshot, false);
    expect(json).not.toContain("coordinates");
    expect(json).not.toContain("selected_area");
    expect(json).not.toContain("12.34567");
    expect(JSON.parse(json).studyAreaIncluded).toBe(false);
    expect(JSON.parse(reportJson(snapshot, true)).studyArea).toEqual(geometry);
  });
  it("strips GeoJSON properties and foreign members", () => {
    expect(
      reportGeometry({
        type: "Feature",
        properties: { private: "secret" },
        geometry: {
          type: "Point",
          coordinates: [1, 2],
          private: "also secret",
        },
      }),
    ).toEqual({ type: "Point", coordinates: [1, 2] });
  });
  it("retains only bounded, sanitized request outcomes", () => {
    for (let index = 0; index < 25; index++)
      recordRequestDiagnostic(
        `https://api.example.com/timeseries/status/job-${index}?secret=hidden`,
        { status: 200 },
      );
    const diagnostics = requestDiagnostics();
    expect(diagnostics).toHaveLength(20);
    expect(diagnostics.every((entry) => entry.operation === "status")).toBe(
      true,
    );
    expect(JSON.stringify(diagnostics)).not.toContain("secret");
    expect(JSON.stringify(diagnostics)).not.toContain("job-");
    diagnostics[0]!.operation = "changed";
    expect(requestDiagnostics()[0]!.operation).toBe("status");
  });
  it("sends feedback and diagnostics only after an explicit call and confirms ingestion", async () => {
    expect(sdk.capture).not.toHaveBeenCalled();
    const reference = await sendBugReport(report);
    expect(reference).toMatch(/^[0-9a-f]{32}$/);
    expect(sdk.capture).toHaveBeenCalledOnce();
    const [params, hint] = sdk.capture.mock.calls[0]!;
    expect(params.message).toBe(report.message);
    expect(hint.attachments[0].filename).toBe("skope-diagnostics.json");
    expect(hint.includeReplay).toBe(false);
    expect(sdk.unsubscribe).toHaveBeenCalledOnce();
    expect(sdk.close).toHaveBeenCalledOnce();
  });
  it("does not claim success for a rejected ingestion response", async () => {
    sdk.status = 429;
    await expect(sendBugReport(report)).rejects.toThrow("not accepted");
  });
  it("does not treat an event ID without a response as successful delivery", async () => {
    vi.useFakeTimers();
    sdk.respond = false;
    const pending = sendBugReport(report);
    const rejected = expect(pending).rejects.toThrow(
      "could not confirm delivery",
    );
    await vi.waitFor(() => expect(sdk.capture).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(12_000);
    await rejected;
    expect(sdk.unsubscribe).toHaveBeenCalledOnce();
  });
  it("offers a failure instead of sending when disabled", async () => {
    await expect(sendBugReport({ ...report, dsn: "" })).rejects.toThrow(
      "not configured",
    );
    expect(sdk.capture).not.toHaveBeenCalled();
  });
});

it("handles malformed saved areas without exposing properties or breaking reports", () => {
  for (const value of [
    null,
    42,
    "not GeoJSON",
    { type: "FeatureCollection" },
    { type: "FeatureCollection", features: null },
    { type: "Feature", geometry: null },
    { type: "Point", coordinates: [{ secret: "private" }] },
    { type: "Unknown", coordinates: [1, 2] },
  ])
    expect(reportGeometry(value)).toBeNull();
  expect(
    reportGeometry({
      type: "GeometryCollection",
      geometries: [{ type: "Point", coordinates: [1, 2] }],
    }),
  ).toEqual({
    type: "GeometryCollection",
    geometries: [{ type: "Point", coordinates: [1, 2] }],
  });
});

it("uses the same inclusive screenshot size limit for validation and sending", () => {
  expect(validReportScreenshot()).toBe(true);
  expect(
    validReportScreenshot(
      new File([new Uint8Array(MAX_SCREENSHOT_BYTES)], "limit.png", {
        type: "image/png",
      }),
    ),
  ).toBe(true);
  expect(
    validReportScreenshot(
      new File([new Uint8Array(MAX_SCREENSHOT_BYTES + 1)], "large.png", {
        type: "image/png",
      }),
    ),
  ).toBe(false);
  expect(
    validReportScreenshot(
      new File(["text"], "report.txt", { type: "text/plain" }),
    ),
  ).toBe(false);
});
