import type { Dataset } from "@/types/metadata";

// Sort object keys, preserving array order (especially geometry coordinates).
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? Object.fromEntries(
          Object.keys(entry)
            .sort()
            .map((key) => [key, entry[key]]),
        )
      : entry,
  );
}

// Properties and Feature wrappers don't affect extraction. Do not round or
// otherwise change coordinates: nearby study areas can select different cells.
export function extractionGeometry(area: any): unknown {
  if (area?.type === "Feature") return extractionGeometry(area.geometry);
  if (area?.type === "FeatureCollection") {
    const geometries = area.features.map(extractionGeometry);
    return geometries.length === 1 ? geometries[0] : geometries;
  }
  return area;
}

export function extractionIdentity(
  request: {
    dataset_id?: string;
    variable_id?: string | null;
    selected_area?: unknown;
  },
  metadata: Dataset | null,
): string {
  return stableJson([
    request.dataset_id,
    metadata?.release_id,
    metadata?.declaration_digest,
    request.variable_id,
    extractionGeometry(request.selected_area),
  ]);
}
