import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { effectScope } from "vue";
import type { TimeseriesRequest } from "@/types/timeseries";
import { flushPromises } from "@vue/test-utils";
import { useExtractionStore } from "@/stores/extraction";
import { useDatasetStore } from "@/stores/dataset";
import { useAnalysisStore } from "@/stores/analysis";
import { useMessagesStore } from "@/stores/messages";
import { useTimeSeriesRequest } from "@/composables/useTimeSeriesRequest";
import metadataFixture from "@/tests/fixtures/metadata-1.0.0.json";
import { extractionIdentity } from "@/utils/extractionIdentity";
import { timeSeriesResponseFixture as RESULT } from "@/tests/fixtures/page-fixtures";

const area = {
  type: "Point" as const,
  coordinates: [-108.5, 37] as [number, number],
};
const request: TimeseriesRequest = {
  dataset_id: "paleocar",
  variable_id: "ppt",
  selected_area: area,
  time_range: { gte: "0103", lte: "2000" },
  zonal_statistic: "mean",
  transform: { type: "NoTransform" },
  requested_series_options: [
    { name: "Original", smoother: { type: "NoSmoother" } },
  ],
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const scopes: ReturnType<typeof effectScope>[] = [];
function consumer(mode: "visualize" | "analyze") {
  const scope = effectScope();
  scopes.push(scope);
  return { scope, ...scope.run(() => useTimeSeriesRequest(mode))! };
}

beforeEach(() => {
  setActivePinia(createPinia());
  const dataset = useDatasetStore();
  dataset.setMetadata({
    ...metadataFixture.datasets[0],
    id: "paleocar",
    release_id: "r1",
    declaration_digest: "d1",
    default_variable: "ppt",
    variables: [{ ...metadataFixture.datasets[0]!.variables[0]!, id: "ppt" }],
  } as any);
  dataset.setVariable("ppt");
  dataset.setGeoJson(area);
});
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("extraction sharing", () => {
  it("shares submission and polling even before the job ID arrives", async () => {
    const submitted = deferred<Response>();
    const fetch = vi
      .fn()
      .mockReturnValueOnce(submitted.promise)
      .mockResolvedValueOnce(respond({ status: "SUCCESS", result: RESULT }));
    vi.stubGlobal("fetch", fetch);
    const first = useExtractionStore().resolveTimeSeries(request);
    const second = useExtractionStore().resolveTimeSeries({ ...request });
    expect(fetch).toHaveBeenCalledTimes(1);
    submitted.resolve(respond({ job_id: "job" }));
    expect(await first).toEqual(RESULT);
    expect(await second).toEqual(RESULT);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("analyzes each consumer's options after sharing the extraction", async () => {
    const completed = deferred<Response>();
    const changed: typeof request = {
      ...request,
      zonal_statistic: "median",
      time_range: { gte: "1500", lte: "1600" },
    };
    const analyzed = { ...RESULT, area: 99 };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(respond({ job_id: "job" }))
      .mockReturnValueOnce(completed.promise)
      .mockResolvedValueOnce(respond(analyzed));
    vi.stubGlobal("fetch", fetch);
    const first = useExtractionStore().resolveTimeSeries(request);
    await flushPromises();
    const second = useExtractionStore().resolveTimeSeries(changed);
    completed.resolve(respond({ status: "SUCCESS", result: RESULT }));
    expect(await first).toEqual(RESULT);
    expect(await second).toEqual(analyzed);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetch.mock.calls[2]![1]!.body)).toMatchObject({
      extraction_id: "job",
      zonal_statistic: "median",
      time_range: changed.time_range,
    });
  });

  it.each([404, 410])(
    "resubmits when analysis returns %i after a shared extraction completes",
    async (status) => {
      const completed = deferred<Response>();
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(respond({ job_id: "old-job" }))
        .mockReturnValueOnce(completed.promise)
        .mockResolvedValueOnce(respond({ detail: "stale" }, status))
        .mockResolvedValueOnce(respond({ job_id: "new-job" }))
        .mockResolvedValueOnce(respond({ status: "SUCCESS", result: RESULT }));
      vi.stubGlobal("fetch", fetch);
      const first = useExtractionStore().resolveTimeSeries(request);
      await flushPromises();
      const second = useExtractionStore().resolveTimeSeries({
        ...request,
        zonal_statistic: "median",
      });
      completed.resolve(respond({ status: "SUCCESS", result: RESULT }));
      await Promise.all([first, second]);
      expect(
        fetch.mock.calls.filter(([url]) => url.endsWith("/extract")),
      ).toHaveLength(2);
      expect(Object.values(useExtractionStore().jobIds)).toEqual(["new-job"]);
    },
  );

  it("reuses a job for equivalent geometry wrappers and property order", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(respond({ job_id: "job" }))
      .mockResolvedValueOnce(respond({ status: "SUCCESS", result: RESULT }))
      .mockResolvedValueOnce(respond(RESULT));
    vi.stubGlobal("fetch", fetch);
    await useExtractionStore().resolveTimeSeries(request);
    await useExtractionStore().resolveTimeSeries({
      ...request,
      selected_area: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "label" },
            geometry: { coordinates: [-108.5, 37], type: "Point" },
          },
        ],
      },
    });
    expect(fetch.mock.calls[2]![0]!).toMatch(/\/timeseries\/analyze$/);
  });

  it.each(["dataset", "release", "digest", "variable", "geometry"])(
    "does not reuse an extraction for a different %s",
    async (field) => {
      const fetch = vi.fn(async (url: string) =>
        url.endsWith("/extract")
          ? respond({ job_id: "job" })
          : respond({ status: "SUCCESS", result: RESULT }),
      );
      vi.stubGlobal("fetch", fetch);
      await useExtractionStore().resolveTimeSeries(request);
      const changed = JSON.parse(JSON.stringify(request));
      const dataset = useDatasetStore();
      if (field === "dataset") changed.dataset_id = "other";
      if (field === "release") dataset.metadata!.release_id = "r2";
      if (field === "digest") dataset.metadata!.declaration_digest = "d2";
      if (field === "variable") changed.variable_id = "other";
      if (field === "geometry")
        changed.selected_area.coordinates[0] += 0.000001;
      await useExtractionStore().resolveTimeSeries(changed);
      expect(
        fetch.mock.calls.filter(([url]) => url.endsWith("/extract")),
      ).toHaveLength(2);
    },
  );

  it("does not repopulate a cleared cache when submission completes late", async () => {
    const submitted = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockReturnValueOnce(submitted.promise)
        .mockResolvedValueOnce(respond({ status: "SUCCESS", result: RESULT })),
    );
    const store = useExtractionStore();
    const pending = store.resolveTimeSeries(request);
    store.clear();
    submitted.resolve(respond({ job_id: "old-job" }));
    await expect(pending).rejects.toThrow("superseded");
    expect(store.jobIds).toEqual({});
  });

  it("stops capacity retries when the study area is retired", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async () => respond({ detail: "capacity" }, 503));
    vi.stubGlobal("fetch", fetch);
    const pending = consumer("visualize").run(request);
    await vi.advanceTimersByTimeAsync(0);
    useDatasetStore().setGeoJson({ type: "Point", coordinates: [0, 0] });
    await vi.advanceTimersByTimeAsync(5000);
    await pending;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(useMessagesStore().messages).toHaveLength(0);
  });

  it("shares polling while recovering concurrent requests for a running job", async () => {
    const store = useExtractionStore();
    store.jobIds[extractionIdentity(request, useDatasetStore().metadata)] =
      "job";
    const completed = deferred<Response>();
    const fetch = vi.fn(async (url: string) => {
      if (url.includes("/status/")) return completed.promise;
      return respond({ detail: "not complete" }, 409);
    });
    vi.stubGlobal("fetch", fetch);
    const first = store.resolveTimeSeries(request);
    const second = store.resolveTimeSeries({
      ...request,
      zonal_statistic: "median",
    });
    await flushPromises();
    expect(
      fetch.mock.calls.filter(([url]) => url.includes("/status/")),
    ).toHaveLength(1);
    fetch.mockImplementation(async () => respond(RESULT));
    completed.resolve(respond({ status: "SUCCESS", result: RESULT }));
    await Promise.all([first, second]);
    expect(fetch.mock.calls.some(([url]) => url.endsWith("/extract"))).toBe(
      false,
    );
  });

  it("snapshots request data before it can change during submission", async () => {
    const submitted = deferred<Response>();
    const fetch = vi
      .fn()
      .mockReturnValueOnce(submitted.promise)
      .mockResolvedValueOnce(respond({ status: "SUCCESS", result: RESULT }));
    vi.stubGlobal("fetch", fetch);
    const data = JSON.parse(JSON.stringify(request));
    const pending = useExtractionStore().resolveTimeSeries(data);
    data.time_range.gte = "1900";
    submitted.resolve(respond({ job_id: "job" }));
    await pending;
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body).time_range.gte).toBe(
      "0103",
    );
  });
});

describe("response ownership", () => {
  it.each(["visualize", "analyze"] as const)(
    "keeps the newest %s response when requests finish out of order",
    async (mode) => {
      const old = deferred<Response>();
      const latest = { ...RESULT, n_cells: 9, area: 99 };
      const store = useExtractionStore();
      store.jobIds[extractionIdentity(request, useDatasetStore().metadata)] =
        "job";
      const fetch = vi
        .fn()
        .mockReturnValueOnce(old.promise)
        .mockResolvedValueOnce(respond(latest));
      vi.stubGlobal("fetch", fetch);
      const page = consumer(mode);
      const first = page.run(request);
      await page.run({ ...request, time_range: { gte: "1500", lte: "1600" } });
      old.resolve(respond(RESULT));
      await first;
      expect(useDatasetStore().numberOfCells).toBe(9);
      if (mode === "analyze") expect(useAnalysisStore().response.area).toBe(99);
    },
  );

  it("ignores a response when its selected range has already changed", async () => {
    const old = deferred<Response>();
    const store = useExtractionStore();
    store.jobIds[extractionIdentity(request, useDatasetStore().metadata)] =
      "job";
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(old.promise));
    const pending = consumer("visualize").run(request);
    useDatasetStore().setTemporalRange([1700, 1800]);
    old.resolve(respond(RESULT));
    await pending;
    expect(useDatasetStore().hasData).toBe(false);
  });

  it.each([200, 500])(
    "ignores an old response (%i) after changing the area away and back",
    async (status) => {
      const old = deferred<Response>();
      const store = useExtractionStore();
      store.jobIds[extractionIdentity(request, useDatasetStore().metadata)] =
        "job";
      vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(old.promise));
      const page = consumer("visualize");
      const pending = page.run(request);
      useDatasetStore().setGeoJson({ type: "Point", coordinates: [0, 0] });
      useDatasetStore().setGeoJson(area);
      old.resolve(
        respond(status === 200 ? RESULT : { detail: "old error" }, status),
      );
      await pending;
      expect(useDatasetStore().hasData).toBe(false);
      expect(useMessagesStore().messages).toHaveLength(0);
      expect(useDatasetStore().timeSeriesRequestStatus.status).not.toBe(
        "servererror",
      );
    },
  );

  it.each(["visualize", "analyze"] as const)(
    "ignores %s errors after leaving the page",
    async (mode) => {
      const old = deferred<Response>();
      const store = useExtractionStore();
      store.jobIds[extractionIdentity(request, useDatasetStore().metadata)] =
        "job";
      vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(old.promise));
      const page = consumer(mode);
      const pending = page.run(request);
      page.scope.stop();
      old.resolve(respond({ detail: "old error" }, 500));
      await pending;
      expect(useMessagesStore().messages).toHaveLength(0);
      expect(useDatasetStore().timeSeriesRequestStatus.status).not.toBe(
        "servererror",
      );
    },
  );

  it("lets Analyze reuse an extraction after Visualize is disposed", async () => {
    const completed = deferred<Response>();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(respond({ job_id: "job" }))
      .mockReturnValueOnce(completed.promise);
    vi.stubGlobal("fetch", fetch);
    const visualize = consumer("visualize");
    const old = visualize.run(request);
    await flushPromises();
    visualize.scope.stop();
    const current = consumer("analyze").run(request);
    completed.resolve(respond({ status: "SUCCESS", result: RESULT }));
    await Promise.all([old, current]);
    expect(useDatasetStore().hasData).toBe(false);
    expect(useAnalysisStore().response.area).toBe(RESULT.area);
    expect(useDatasetStore().timeSeriesRequestStatus.status).toBe("success");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

it("reports an empty visualization response without leaving a successful plot state", async () => {
  vi.spyOn(useExtractionStore(), "resolveTimeSeries").mockResolvedValueOnce({
    ...RESULT,
    series: [],
  });
  await consumer("visualize").run(request);
  expect(useDatasetStore().timeSeriesRequestStatus.status).toBe("servererror");
  expect(useMessagesStore().messages.at(-1)?.message).toBe(
    "The API returned no time series.",
  );
});

it("retains an uncertain submission key and its original payload across a later user retry", async () => {
  vi.useFakeTimers();
  const fetch = vi
    .fn()
    .mockImplementation(() => new Promise<Response>(() => {}));
  vi.stubGlobal("fetch", fetch);
  const store = useExtractionStore();
  const outcome = expect(
    store.resolveTimeSeries(request),
  ).rejects.toMatchObject({ code: "SUBMISSION_TIMEOUT" });
  await vi.advanceTimersByTimeAsync(60_000);
  await outcome;
  const originalKey = fetch.mock.calls[0]?.[1].headers.get("Idempotency-Key");
  const originalPayload = fetch.mock.calls[0]?.[1].body;
  const attemptCount = fetch.mock.calls.length;
  const changed = { ...request, zonal_statistic: "median" as const };
  fetch
    .mockReset()
    .mockResolvedValueOnce(respond({ job_id: "recovered" }))
    .mockResolvedValueOnce(respond({ status: "SUCCESS", result: RESULT }))
    .mockResolvedValueOnce(respond({ ...RESULT, zonal_statistic: "median" }));
  await expect(store.resolveTimeSeries(changed)).resolves.toMatchObject({
    zonal_statistic: "median",
  });
  expect(attemptCount).toBeGreaterThan(1);
  expect(fetch.mock.calls[0]?.[1].headers.get("Idempotency-Key")).toBe(
    originalKey,
  );
  expect(fetch.mock.calls[0]?.[1].body).toBe(originalPayload);
  expect(JSON.parse(fetch.mock.calls[2]?.[1].body).zonal_statistic).toBe(
    "median",
  );
});

it("aborts retired source connections without canceling variable switches or navigation", async () => {
  let signal: AbortSignal | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn((_url, options) => {
      signal = options.signal;
      return new Promise<Response>(() => {});
    }),
  );
  const pending = useExtractionStore().resolveTimeSeries(request);
  const outcome = expect(pending).rejects.toMatchObject({ code: "SUPERSEDED" });
  useDatasetStore().setVariable("other");
  expect(signal?.aborted).toBe(false);
  useDatasetStore().setGeoJson({ type: "Point", coordinates: [0, 0] });
  await outcome;
  expect(signal?.aborted).toBe(true);
});

it("retains a successful extraction after an analysis connection timeout", async () => {
  vi.useFakeTimers();
  const store = useExtractionStore();
  const key = extractionIdentity(request, useDatasetStore().metadata);
  store.jobIds[key] = "successful-job";
  const fetch = vi
    .fn()
    .mockImplementationOnce(() => new Promise<Response>(() => {}))
    .mockResolvedValueOnce(respond(RESULT));
  vi.stubGlobal("fetch", fetch);
  const outcome = expect(
    store.resolveTimeSeries(request),
  ).rejects.toMatchObject({ code: "HTTP_TIMEOUT" });
  await vi.advanceTimersByTimeAsync(30_000);
  await outcome;
  expect(store.jobIds[key]).toBe("successful-job");
  await store.resolveTimeSeries(request);
  expect(fetch.mock.calls.every(([url]) => url.endsWith("/analyze"))).toBe(
    true,
  );
});

it.each(["PROCESSING_TIMEOUT", "WORKER_LOST"])(
  "requires a new user attempt after %s instead of automatically extracting again",
  async (code) => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(respond({ job_id: "failed-job" }))
      .mockResolvedValueOnce(
        respond({
          status: code === "PROCESSING_TIMEOUT" ? "TIMED_OUT" : "FAILED",
          error_code: code,
          error: "failed",
        }),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(
      useExtractionStore().resolveTimeSeries(request),
    ).rejects.toMatchObject({ code });
    expect(
      fetch.mock.calls.filter(([url]) => url.endsWith("/extract")),
    ).toHaveLength(1);
    expect(useExtractionStore().jobIds).toEqual({});
  },
);

it.each(["processing", "gateway"])(
  "gives cause-specific advice for a %s timeout",
  async (kind) => {
    const store = useExtractionStore();
    const key = extractionIdentity(request, useDatasetStore().metadata);
    store.jobIds[key] = "existing";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respond(
          {
            detail: {
              code:
                kind === "processing"
                  ? "PROCESSING_TIMEOUT"
                  : "GATEWAY_TIMEOUT",
              msg: "Timed out",
            },
          },
          504,
        ),
      ),
    );
    await consumer("visualize").run(request);
    const messages = useMessagesStore()
      .messages.map((message) => message.message)
      .join(" ");
    expect(messages.includes("smaller")).toBe(kind === "processing");
    expect(useDatasetStore().timeSeriesRequestStatus.status).toBe(
      kind === "processing" ? "timeout" : "servererror",
    );
  },
);
