import { beforeEach, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useBugReport } from "@/composables/useBugReport";
import { useDatasetStore } from "@/stores/dataset";
import { useExtractionStore } from "@/stores/extraction";
import { requestJson } from "@/utils/requestJson";
import { extractionIdentity } from "@/utils/extractionIdentity";
import { reportJson } from "@/utils/bugReport";
import metadata from "@/tests/fixtures/metadata-1.0.0.json";
import type { Dataset } from "@/types/metadata";

vi.mock("@/utils/requestJson", async (original) => ({
  ...(await original<typeof import("@/utils/requestJson")>()),
  requestJson: vi.fn(),
}));
beforeEach(() => {
  setActivePinia(createPinia());
  vi.stubGlobal("useRuntimeConfig", () => ({
    public: { apiBase: "https://test.example.com" },
  }));
  const dataset = useDatasetStore();
  dataset.setMetadata(metadata.datasets[0] as unknown as Dataset);
  dataset.setGeoJson({ type: "Point", coordinates: [-108.12345, 37.6789] });
});

it("keeps reports available if the API is unreachable", async () => {
  vi.mocked(requestJson).mockRejectedValueOnce(new Error("offline"));
  const report = useBugReport();
  await report.capture();
  expect(report.loading.value).toBe(false);
  expect(report.snapshot.value.apiVersion).toEqual({ status: "unavailable" });
  expect(report.snapshot.value.uiBuildId).toBe("test-build");
  expect(reportJson(report.snapshot.value, false)).not.toContain("-108.12345");
});

it("captures the current job and freezes the selection before checking API version", async () => {
  const dataset = useDatasetStore();
  const source = dataset.metadata!;
  const key = extractionIdentity(
    {
      dataset_id: source.id,
      variable_id: dataset.variableId,
      selected_area: dataset.geoJson,
    },
    source,
  );
  useExtractionStore().jobIds[key] = "known-job";
  let complete!: (value: { build_id: string; environment: string }) => void;
  vi.mocked(requestJson).mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  const report = useBugReport();
  const pending = report.capture();
  dataset.setGeoJson({ type: "Point", coordinates: [1, 2] });
  complete({ build_id: "api-123", environment: "staging" });
  await pending;
  expect(report.snapshot.value.extractionJobId).toBe("known-job");
  expect(report.snapshot.value.studyArea).toEqual({
    type: "Point",
    coordinates: [-108.12345, 37.6789],
  });
  expect(report.snapshot.value.apiVersion).toEqual({
    buildId: "api-123",
    environment: "staging",
  });
});

it("can still capture diagnostics when the API address is invalid", async () => {
  vi.stubGlobal("useRuntimeConfig", () => ({
    public: { apiBase: "http://[" },
  }));
  const report = useBugReport();
  await report.capture();
  expect(report.loading.value).toBe(false);
  expect(report.snapshot.value.apiBase).toBe("unavailable");
  expect(report.snapshot.value.apiVersion).toEqual({ status: "unavailable" });
});
