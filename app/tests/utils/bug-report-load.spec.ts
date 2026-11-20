import { afterEach, expect, it, vi } from "vitest";
import { sendBugReport } from "@/utils/bugReport";

const sdk = vi.hoisted(() => ({
  release: undefined as undefined | (() => void),
  client: vi.fn(),
}));
vi.mock("@sentry/nuxt", async () => {
  await new Promise<void>((resolve) => {
    sdk.release = resolve;
  });
  return { BrowserClient: sdk.client };
});
afterEach(() => vi.useRealTimers());

it("bounds SDK loading and never sends later after that attempt times out", async () => {
  vi.useFakeTimers();
  const pending = sendBugReport({
    dsn: "https://public@example.com/1",
    message: "A problem",
    email: "",
    diagnostics: "{}",
    buildId: "test",
    page: "https://example.com/",
  });
  const rejected = expect(pending).rejects.toThrow(
    "reporting service could not load",
  );
  await vi.waitFor(() => expect(sdk.release).toBeTypeOf("function"));
  await vi.advanceTimersByTimeAsync(12_000);
  await rejected;
  sdk.release!();
  await vi.dynamicImportSettled();
  expect(sdk.client).not.toHaveBeenCalled();
});
