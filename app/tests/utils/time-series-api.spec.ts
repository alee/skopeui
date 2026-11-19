import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createTimeSeriesApi } from "@/utils/timeSeriesApi";
import type { TimeseriesRequest } from "@/types/timeseries";

const api = createTimeSeriesApi("https://api.example.test");
const request = {} as TimeseriesRequest;
const reply = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers });
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("retries a lost acceptance response with the identical key and payload", async () => {
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("lost response"))
    .mockResolvedValueOnce(reply({ job_id: "original-job" }, 202));
  vi.stubGlobal("fetch", fetch);
  const pending = api.submitTimeSeriesRequest(request, {
    key: "one-attempt",
    releaseId: "release",
    declarationDigest: "digest",
  });
  await vi.advanceTimersByTimeAsync(5000);
  await expect(pending).resolves.toBe("original-job");
  expect(fetch).toHaveBeenCalledTimes(2);
  for (const [, options] of fetch.mock.calls) {
    expect(options.headers.get("Idempotency-Key")).toBe("one-attempt");
    expect(options.headers.get("X-Skope-Release-Id")).toBe("release");
    expect(options.body).toBe(JSON.stringify(request));
  }
});

it("bounds repeated stalled submission connections to sixty seconds", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => {})),
  );
  const start = Date.now();
  const outcome = expect(
    api.submitTimeSeriesRequest(request, { key: "stalled" }),
  ).rejects.toMatchObject({ code: "SUBMISSION_TIMEOUT" });
  await vi.advanceTimersByTimeAsync(60_000);
  await outcome;
  expect(Date.now() - start).toBe(60_000);
  expect(vi.getTimerCount()).toBe(0);
});

it("never waits beyond the capacity budget even for a very long Retry-After", async () => {
  const fetch = vi.fn(async () =>
    reply({ detail: { code: "CAPACITY_EXHAUSTED", msg: "Busy" } }, 503, {
      "Retry-After": "600",
    }),
  );
  vi.stubGlobal("fetch", fetch);
  const outcome = expect(
    api.submitTimeSeriesRequest(request, { key: "busy" }),
  ).rejects.toMatchObject({ code: "CAPACITY_EXHAUSTED" });
  await vi.advanceTimersByTimeAsync(60_000);
  await outcome;
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("does not retry conflicting keys or expired submissions", async () => {
  for (const [status, code] of [
    [409, "IDEMPOTENCY_CONFLICT"],
    [410, "RESULT_EXPIRED"],
  ] as const) {
    const fetch = vi.fn(async () =>
      reply({ detail: { code, msg: code } }, status),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(
      api.submitTimeSeriesRequest(request, { key: "existing" }),
    ).rejects.toMatchObject({ code });
    expect(fetch).toHaveBeenCalledTimes(1);
  }
});

it.each(["connection", "body", "pending"])(
  "bounds polling when %s stalls",
  async (kind) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        kind === "connection"
          ? new Promise<Response>(() => {})
          : Promise.resolve(
              kind === "body"
                ? new Response(new ReadableStream({ start() {} }))
                : reply({ status: "PROCESSING" }),
            ),
      ),
    );
    const outcome = expect(
      api.pollTimeSeriesStatus("accepted-job"),
    ).rejects.toMatchObject({ code: "POLLING_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(60_000);
    await outcome;
    expect(vi.getTimerCount()).toBe(0);
  },
);

it("keeps backend processing timeout distinct from a browser wait timeout", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      reply({
        status: "TIMED_OUT",
        error_code: "PROCESSING_TIMEOUT",
        error: "Processing exceeded 20000 ms.",
      }),
    ),
  );
  await expect(api.pollTimeSeriesStatus("timed-out")).rejects.toMatchObject({
    code: "PROCESSING_TIMEOUT",
  });
});

it("aborts a capacity wait immediately without making another request", async () => {
  const fetch = vi.fn(async () =>
    reply({ detail: { code: "CAPACITY_EXHAUSTED", msg: "Busy" } }, 503),
  );
  vi.stubGlobal("fetch", fetch);
  const controller = new AbortController();
  const outcome = expect(
    api.submitTimeSeriesRequest(request, {
      key: "retired",
      signal: controller.signal,
    }),
  ).rejects.toMatchObject({ code: "SUPERSEDED" });
  await vi.advanceTimersByTimeAsync(0);
  controller.abort();
  await outcome;
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it("bounds synchronous analysis without treating it as an extraction timeout", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => {})),
  );
  const outcome = expect(
    api.refineTimeSeriesAnalysis("existing", request),
  ).rejects.toMatchObject({ code: "HTTP_TIMEOUT" });
  await vi.advanceTimersByTimeAsync(30_000);
  await outcome;
});

it("keeps phase budgets bounded when the system wall clock moves backwards", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => {})),
  );
  const outcome = expect(
    api.pollTimeSeriesStatus("accepted-job"),
  ).rejects.toMatchObject({ code: "POLLING_TIMEOUT" });
  await vi.advanceTimersByTimeAsync(20_000);
  vi.setSystemTime(Date.now() - 3600_000);
  await vi.advanceTimersByTimeAsync(40_000);
  await outcome;
  expect(vi.getTimerCount()).toBe(0);
});
