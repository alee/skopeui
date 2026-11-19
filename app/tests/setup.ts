import { beforeEach, vi } from "vitest";
import { useRuntimeConfig } from "nuxt/app";

// Test the Nuxt boundary without booting a server or evaluating virtual modules.
vi.mock("nuxt/app", () => ({ useRuntimeConfig: vi.fn() }));

beforeEach(() => {
  vi.mocked(useRuntimeConfig).mockReturnValue({
    public: { apiBase: "https://test.example.com" },
  } as ReturnType<typeof useRuntimeConfig>);
  vi.stubGlobal("useAppConfig", () => ({ buildId: "test-build" }));
});
