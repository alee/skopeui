import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useRuntimeConfig } from "nuxt/app";
import type { TimeseriesRequest } from "@/types/timeseries";

import { useExtractionStore } from "@/stores/extraction";
import { extractionIdentity } from "@/utils/extractionIdentity";
import { useDatasetStore } from "@/stores/dataset";

const RESULT = { series: [], summary_stats: [], n_cells: 1, area: 0 };

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

// Seed a previously submitted job to exercise API recovery paths.
async function resolve(
  existingJobId: string | undefined,
  data: Record<string, any>,
) {
  const store = useExtractionStore();
  const key = extractionIdentity(data, useDatasetStore().metadata);
  if (existingJobId) store.jobIds[key] = existingJobId;
  // Recovery tests exercise the store below the composable that validates requests.
  const response = await store.resolveTimeSeries(data as TimeseriesRequest);
  return { newJobId: store.jobIds[key], response };
}

describe("resolveTimeSeries", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uses the runtime API base for extraction, polling and analysis", async () => {
    vi.mocked(useRuntimeConfig).mockReturnValue({
      public: { apiBase: "https://runtime.example.test/v3/" },
    } as ReturnType<typeof useRuntimeConfig>);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(200, { job_id: "runtime-job" }))
      .mockResolvedValueOnce(
        respond(200, { status: "SUCCESS", result: RESULT }),
      )
      .mockResolvedValueOnce(respond(200, RESULT));
    vi.stubGlobal("fetch", fetchMock);
    const store = useExtractionStore();
    await store.resolveTimeSeries({} as any);
    await store.resolveTimeSeries({
      transform: { type: "NoTransform" },
    } as any);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://runtime.example.test/v3/timeseries/extract",
      "https://runtime.example.test/v3/timeseries/status/runtime-job",
      "https://runtime.example.test/v3/timeseries/analyze",
    ]);
  });

  it.each([404, 410])(
    "extracts again when /analyze answers %i for the cached job",
    async (status) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(respond(status, { detail: "stale" }))
        .mockResolvedValueOnce(respond(200, { job_id: "new-job" }))
        .mockResolvedValueOnce(
          respond(200, { status: "SUCCESS", result: RESULT }),
        );
      vi.stubGlobal("fetch", fetchMock);

      const { newJobId, response } = await resolve("old-job", {});

      expect(newJobId).toBe("new-job");
      expect(response).toEqual(RESULT);
      expect(fetchMock.mock.calls[1]![0]!).toMatch(/\/timeseries\/extract$/);
    },
  );

  it("reports a 422 instead of extracting again", async () => {
    // The request itself can't be computed, e.g. a z-score reference period
    // without values: a new extraction would fail the same way.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(422, { detail: "needs at least 2" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolve("job", {})).rejects.toMatchObject({
      response: { status: 422 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("waits for a running extraction instead of starting a second one", async () => {
    // Analyze opened while visualize's extraction runs: /analyze answers 409,
    // and a new /extract would be refused at capacity.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(409, { detail: "not complete" }))
      .mockResolvedValueOnce(respond(200, { status: "PROCESSING" }))
      .mockResolvedValueOnce(
        respond(200, { status: "SUCCESS", result: RESULT }),
      )
      .mockResolvedValueOnce(respond(200, RESULT));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    const pending = resolve("running-job", {});
    await vi.runAllTimersAsync();
    const { newJobId, response } = await pending;
    vi.useRealTimers();

    expect(newJobId).toBe("running-job");
    expect(response).toEqual(RESULT);
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.some((url) => url.endsWith("/timeseries/extract"))).toBe(false);
    expect(urls.at(-1)).toMatch(/\/timeseries\/analyze$/);
  });

  it("requires another user attempt when the cached extraction failed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(409, { detail: "not complete" }))
      .mockResolvedValueOnce(respond(200, { status: "FAILED" }))
      .mockResolvedValueOnce(respond(200, { job_id: "new-job" }))
      .mockResolvedValueOnce(
        respond(200, { status: "SUCCESS", result: RESULT }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolve("old-job", {})).rejects.toMatchObject({
      code: "EXTRACTION_FAILED",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const { newJobId } = await resolve(undefined, {});
    expect(newJobId).toBe("new-job");
    expect(fetchMock.mock.calls[2]![0]!).toMatch(/\/timeseries\/extract$/);
  });

  it.each([404, 410])(
    "extracts again when /analyze answers %i after waiting for a running job",
    async (status) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(respond(409, { detail: "not complete" }))
        .mockResolvedValueOnce(
          respond(200, { status: "SUCCESS", result: RESULT }),
        )
        .mockResolvedValueOnce(
          respond(status, { detail: "stale or too narrow" }),
        )
        .mockResolvedValueOnce(respond(200, { job_id: "new-job" }))
        .mockResolvedValueOnce(
          respond(200, { status: "SUCCESS", result: RESULT }),
        );
      vi.stubGlobal("fetch", fetchMock);
      const request = {
        variable_id: "ppt_annual",
        time_range: { gte: "0103", lte: "2000" },
      };

      const result = await resolve("running-job", request);

      expect(result).toEqual({ newJobId: "new-job", response: RESULT });
      const [url, options] = fetchMock.mock.calls[3]!;
      expect(url).toMatch(/\/timeseries\/extract$/);
      expect(JSON.parse(options.body)).toEqual(request);
    },
  );

  it("reports a 422 after waiting without extracting again", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(409, { detail: "not complete" }))
      .mockResolvedValueOnce(
        respond(200, { status: "SUCCESS", result: RESULT }),
      )
      .mockResolvedValueOnce(respond(422, { detail: "needs at least 2" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolve("running-job", {})).rejects.toMatchObject({
      response: { status: 422 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reports a timed-out extraction without extracting again", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(409, { detail: "not complete" }))
      .mockResolvedValueOnce(
        respond(200, {
          status: "TIMED_OUT",
          error: "Processing exceeded 20000 ms.",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolve("old-job", {})).rejects.toMatchObject({
      code: "PROCESSING_TIMEOUT",
      message: "Processing exceeded 20000 ms.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("records a new extraction's job as soon as it's submitted", async () => {
    let jobIdWhilePolling: string | undefined;
    const store = useExtractionStore();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(200, { job_id: "new-job" }))
      .mockImplementationOnce(async () => {
        jobIdWhilePolling = Object.values(store.jobIds)[0];
        return respond(200, { status: "SUCCESS", result: RESULT });
      });
    vi.stubGlobal("fetch", fetchMock);

    await resolve(undefined, {
      variable_id: "ppt_annual",
    });

    expect(jobIdWhilePolling).toBe("new-job");
  });

  it("retries an extraction the API is at capacity for", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        respond(503, {
          detail: { code: "CAPACITY_EXHAUSTED", msg: "at capacity" },
        }),
      )
      .mockResolvedValueOnce(
        respond(503, {
          detail: { code: "CAPACITY_EXHAUSTED", msg: "at capacity" },
        }),
      )
      .mockResolvedValueOnce(respond(200, { job_id: "new-job" }))
      .mockResolvedValueOnce(
        respond(200, { status: "SUCCESS", result: RESULT }),
      );
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    const pending = resolve(undefined, {});
    await vi.advanceTimersByTimeAsync(4_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(6_000);
    const { newJobId } = await pending;
    vi.useRealTimers();

    expect(newJobId).toBe("new-job");
  });

  it("gives up on capacity after about a minute", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respond(503, {
          detail: { code: "CAPACITY_EXHAUSTED", msg: "at capacity" },
        }),
      ),
    );
    vi.useFakeTimers();

    const pending = resolve(undefined, {});
    const outcome = expect(pending).rejects.toMatchObject({
      response: { status: 503 },
    });
    await vi.advanceTimersByTimeAsync(65_000);
    await outcome;
    vi.useRealTimers();
  });

  it("passes on other errors from /analyze", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respond(500, { detail: "boom" })),
    );

    await expect(resolve("old-job", {})).rejects.toMatchObject({
      response: { status: 500 },
    });
  });
});
