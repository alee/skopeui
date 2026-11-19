import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { requestJson, retryAfterSeconds } from "@/utils/requestJson";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-18T12:00:00Z"));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("bounds a stalled fetch even when the transport ignores AbortSignal", async () => {
  const fetch = vi.fn(
    (_url: RequestInfo | URL, _options?: RequestInit) =>
      new Promise<Response>(() => {}),
  );
  vi.stubGlobal("fetch", fetch);
  const pending = requestJson("/never", {}, { timeoutMs: 100 });
  const outcome = expect(pending).rejects.toMatchObject({
    code: "HTTP_TIMEOUT",
  });
  await vi.advanceTimersByTimeAsync(100);
  await outcome;
  expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it.each([200, 503])(
  "bounds a stalled %i response body as part of the same operation",
  async (status) => {
    const response = new Response(new ReadableStream({ start() {} }), {
      status,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response),
    );
    const outcome = expect(
      requestJson("/body", {}, { timeoutMs: 100 }),
    ).rejects.toMatchObject({ code: "HTTP_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(100);
    await outcome;
    expect(vi.getTimerCount()).toBe(0);
  },
);

it("uses only the remaining phase budget", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url: RequestInfo | URL, _options?: RequestInit) =>
        new Promise<Response>(() => {}),
    ),
  );
  const outcome = expect(
    requestJson(
      "/deadline",
      {},
      { timeoutMs: 1000, deadline: performance.now() + 50 },
    ),
  ).rejects.toMatchObject({ code: "HTTP_TIMEOUT" });
  await vi.advanceTimersByTimeAsync(50);
  await outcome;
});

it("distinguishes supersession from timeouts and clears its timer", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url: RequestInfo | URL, _options?: RequestInit) =>
        new Promise<Response>(() => {}),
    ),
  );
  const controller = new AbortController();
  const outcome = expect(
    requestJson("/abort", { signal: controller.signal }),
  ).rejects.toMatchObject({ code: "SUPERSEDED" });
  controller.abort();
  await outcome;
  expect(vi.getTimerCount()).toBe(0);
});

it("merges Headers without dropping content type and removes a completed request's timer", async () => {
  const fetch = vi.fn(
    async (_url: RequestInfo | URL, _options?: RequestInit) =>
      new Response('{"ok":true}'),
  );
  vi.stubGlobal("fetch", fetch);
  await expect(
    requestJson("/headers", {
      headers: new Headers({ "Idempotency-Key": "stable" }),
    }),
  ).resolves.toEqual({ ok: true });
  const headers = new Headers(fetch.mock.calls[0]?.[1]?.headers);
  expect(headers.get("Idempotency-Key")).toBe("stable");
  expect(headers.get("Content-Type")).toBe("application/json");
  expect(vi.getTimerCount()).toBe(0);
});

it("retains structured server failures and Retry-After", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            detail: { code: "CAPACITY_EXHAUSTED", msg: "Busy" },
          }),
          { status: 503, headers: { "Retry-After": "3" } },
        ),
    ),
  );
  await expect(requestJson("/busy")).rejects.toMatchObject({
    code: "CAPACITY_EXHAUSTED",
    message: "Busy",
    response: { status: 503, retryAfter: 3 },
  });
});

it("reads numeric and HTTP-date Retry-After values and ignores invalid values", () => {
  expect(retryAfterSeconds("0")).toBe(0);
  expect(retryAfterSeconds("3")).toBe(3);
  expect(retryAfterSeconds(new Date(Date.now() + 5000).toUTCString())).toBe(5);
  expect(retryAfterSeconds("invalid")).toBeUndefined();
  expect(retryAfterSeconds("-1")).toBeUndefined();
});

it("rejects a late response even if the browser delayed dispatching the timeout callback", async () => {
  const started = performance.now();
  const now = vi.spyOn(performance, "now").mockReturnValue(started);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      now.mockReturnValue(started + 101);
      return new Response("{}");
    }),
  );
  await expect(
    requestJson("/late", {}, { timeoutMs: 100 }),
  ).rejects.toMatchObject({ code: "HTTP_TIMEOUT" });
  expect(vi.getTimerCount()).toBe(0);
});
