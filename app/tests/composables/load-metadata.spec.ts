import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useRuntimeConfig } from "nuxt/app";

import { useDatasetMetadata } from "@/composables/useDatasetMetadata";
import { useDatasetStore } from "@/stores/dataset";
import { useMetadataStore } from "@/stores/metadata";
import metadataFixture from "@/tests/fixtures/metadata-1.0.0.json";

function serve(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
  );
}

describe("loadAllDatasetMetadata", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the runtime API base including a path prefix", async () => {
    vi.mocked(useRuntimeConfig).mockReturnValue({
      public: { apiBase: "https://runtime.example.test/v3/" },
    } as ReturnType<typeof useRuntimeConfig>);
    serve(metadataFixture);
    await useDatasetMetadata().loadAllDatasetMetadata();
    expect(fetch).toHaveBeenCalledWith(
      "https://runtime.example.test/v3/metadata",
      expect.anything(),
    );
  });

  it("stores the datasets of a 1.0.0 response", async () => {
    serve(metadataFixture);
    await useDatasetMetadata().loadAllDatasetMetadata();

    const store = useMetadataStore();
    expect(store.allDatasetMetadata.map((d) => d.id)).toEqual(["paleocar_v3"]);
    expect(store.updateRequired).toBe(false);
  });

  it("flags an update when the API serves another major version", async () => {
    serve({ ...metadataFixture, schema_version: "2.0.0" });
    await expect(useDatasetMetadata().loadAllDatasetMetadata()).rejects.toThrow(
      "this UI reads 1.x",
    );

    const store = useMetadataStore();
    expect(store.updateRequired).toBe(true);
    expect(store.allDatasetMetadata).toEqual([]);
  });

  it("fetches again on every call, so a changed API is noticed", async () => {
    serve(metadataFixture);
    const actions = useDatasetMetadata();
    await actions.loadAllDatasetMetadata();
    await actions.loadAllDatasetMetadata();

    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("initializeDataset", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("selects the dataset's default variable when the URL names none", async () => {
    const [paleocar] = metadataFixture.datasets;
    serve({
      ...metadataFixture,
      datasets: [{ ...paleocar, default_variable: "gdd_cotton_annual" }],
    });
    await useDatasetMetadata().initializeDataset("paleocar_v3");

    expect(useDatasetStore().variable.id).toBe("gdd_cotton_annual");
  });

  it("falls back to the first variable without a default", async () => {
    const [paleocar] = metadataFixture.datasets;
    serve({
      ...metadataFixture,
      datasets: [{ ...paleocar, default_variable: null }],
    });
    await useDatasetMetadata().initializeDataset("paleocar_v3");

    expect(useDatasetStore().variable.id).toBe("ppt_annual");
  });

  it("doesn't wait for metadata between a loaded dataset's steps", async () => {
    // The request can sit behind a running extraction; the next page shouldn't.
    serve(metadataFixture);
    const actions = useDatasetMetadata();
    await actions.initializeDataset("paleocar_v3");
    let answer: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))),
    );

    await actions.initializeDataset("paleocar_v3");

    expect(fetch).toHaveBeenCalledTimes(1);
    answer(new Response(JSON.stringify(metadataFixture), { status: 200 }));
  });

  it("still notices a changed API between a loaded dataset's steps", async () => {
    serve(metadataFixture);
    const actions = useDatasetMetadata();
    await actions.initializeDataset("paleocar_v3");
    serve({ ...metadataFixture, schema_version: "2.0.0" });

    await actions.initializeDataset("paleocar_v3");
    await vi.waitFor(() =>
      expect(useMetadataStore().updateRequired).toBe(true),
    );
  });

  it("keeps the variable the URL names", async () => {
    serve(metadataFixture);
    await useDatasetMetadata().initializeDataset(
      "paleocar_v3",
      "gdd_cotton_annual",
    );

    expect(useDatasetStore().variable.id).toBe("gdd_cotton_annual");
  });
});
