import type { Bbox } from "@/composables/useMapInitialViewport";

export function emptyFeatureCollection() {
  return { type: "FeatureCollection", features: [] as any[] };
}

export function mapExtentPolygon([west, south, east, north]: Bbox): any {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ],
        },
      },
    ],
  };
}

export function normalizeGeoJson(geoJson: any): any {
  if (!geoJson) return null;
  if (geoJson.type === "FeatureCollection") return geoJson;
  if (geoJson.type === "Feature")
    return { type: "FeatureCollection", features: [geoJson] };
  if (geoJson.type && geoJson.coordinates) {
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: geoJson,
        },
      ],
    };
  }
  return null;
}
