import { effectScope } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDatasetPage } from "@/composables/useDatasetPage";
import fixture from "@/tests/fixtures/metadata-1.0.0.json";

describe("dataset page load state", () => {
  const scopes: ReturnType<typeof effectScope>[] = [];
  function page(id = "paleocar_v3", variable?: string) {
    const scope = effectScope();
    scopes.push(scope);
    return scope.run(() => useDatasetPage(id, variable))!;
  }
  function serveMetadata() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(fixture))),
    );
  }
  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop());
    vi.unstubAllGlobals();
  });

  it("ends a failed load and retries successfully without reloading the page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const metadata = page();
    expect(metadata.state.value).toBe("loading");
    expect(await metadata.load()).toBe(false);
    expect(metadata.state.value).toBe("error");
    serveMetadata();
    expect(await metadata.load()).toBe(true);
    expect(metadata.state.value).toBe("ready");
  });

  it.each([
    ["unknown_dataset", undefined],
    ["paleocar_v3", "unknown_variable"],
  ])(
    "distinguishes a missing dataset or variable from loading (%s, %s)",
    async (id, variable) => {
      serveMetadata();
      const metadata = page(id, variable);
      expect(await metadata.load()).toBe(false);
      expect(metadata.state.value).toBe("not-found");
    },
  );

  it("does not publish late load state after the page is disposed", async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const metadata = page();
    const pending = metadata.load();
    scopes[0]!.stop();
    finish(new Response(JSON.stringify(fixture)));
    expect(await pending).toBe(false);
    expect(metadata.state.value).toBe("loading");
  });
});
