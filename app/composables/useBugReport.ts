import { ref } from "vue";
import { useDatasetStore } from "@/stores/dataset";
import { useAnalysisStore } from "@/stores/analysis";
import { useExtractionStore } from "@/stores/extraction";
import { extractionIdentity } from "@/utils/extractionIdentity";
import { reportGeometry, withoutStudyArea } from "@/utils/bugReport";
import { requestDiagnostics } from "@/utils/requestDiagnostics";
import { requestJson } from "@/utils/requestJson";

export function useBugReport() {
  const dataset = useDatasetStore();
  const analysis = useAnalysisStore();
  const extraction = useExtractionStore();
  const config = useRuntimeConfig();
  const { buildId } = useAppConfig();
  const snapshot = ref<Record<string, unknown>>({});
  const loading = ref(false);
  let generation = 0;

  async function capture() {
    const current = ++generation;
    const source = dataset.metadata;
    let extractionJobId: string | null = null;
    try {
      const key = extractionIdentity(
        {
          dataset_id: source?.id,
          variable_id: dataset.variableId,
          selected_area: dataset.geoJson,
        },
        source,
      );
      extractionJobId = extraction.jobIds[key] ?? null;
    } catch {
      // Invalid saved geometry can be the reason someone is reporting a bug.
    }
    let api: URL | undefined;
    try {
      api = new URL(config.public.apiBase, window.location.origin);
    } catch {
      /* A misconfigured API must not prevent a support report. */
    }
    const context: Record<string, unknown> = {
      capturedAt: new Date().toISOString(),
      page: window.location.origin + window.location.pathname,
      uiBuildId: buildId,
      apiBase: api ? api.origin + api.pathname : "unavailable",
      apiVersion: { status: "unavailable" },
      browser: navigator.userAgent,
      language: navigator.language,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: window.devicePixelRatio,
      },
      source: source
        ? {
            datasetId: source.id,
            title: source.title,
            variableId: dataset.variableId,
            releaseId: source.release_id,
            declarationDigest: source.declaration_digest,
          }
        : null,
      selectedInterval: dataset.temporalRange,
      displayedMapStep: dataset.visualizeStep,
      workflowStatus: dataset.timeSeriesRequestStatus.status,
      analysisFormDraft:
        source && dataset.variableId
          ? (analysis.formDrafts[`${source.id}:${dataset.variableId}`] ?? null)
          : null,
      analysisSettings: withoutStudyArea(analysis.requestData),
      displayedResultSettings: withoutStudyArea(analysis.completedRequest),
      extractionJobId,
      studyArea: reportGeometry(dataset.geoJson),
      recentRequests: requestDiagnostics(),
    };
    // Freeze the problem context when opened, before any asynchronous work.
    snapshot.value = JSON.parse(JSON.stringify(context));
    loading.value = true;
    try {
      if (!api) return;
      const version = await requestJson<{
        build_id?: unknown;
        environment?: unknown;
      }>(
        `${config.public.apiBase.replace(/\/$/, "")}/version`,
        {},
        { timeoutMs: 3000 },
      );
      if (current !== generation) return;
      snapshot.value.apiVersion = {
        buildId:
          typeof version.build_id === "string"
            ? version.build_id
            : "unavailable",
        environment:
          typeof version.environment === "string"
            ? version.environment
            : "unavailable",
      };
    } catch {
      // Support reporting must remain available when the API is the problem.
    } finally {
      if (current === generation) loading.value = false;
    }
  }

  return { snapshot, loading, capture };
}
