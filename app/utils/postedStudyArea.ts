import { hasStudyArea } from "./studyArea";

/** CyberSW historically sends form data even with a JSON Content-Type. */
export function parsePostedStudyArea(body: string): unknown {
  const data = body.trim().startsWith("{")
    ? JSON.parse(body).studyArea
    : new URLSearchParams(body).get("studyArea");
  const area = typeof data === "string" ? JSON.parse(data) : data;
  const feature =
    area?.type === "FeatureCollection" && area.features?.length === 1
      ? area.features[0]
      : area;
  const geometry = feature?.type === "Feature" ? feature.geometry : feature;
  if (
    !hasStudyArea(geometry) ||
    !["Point", "Polygon"].includes(geometry?.type)
  ) {
    throw new Error("studyArea must contain one GeoJSON point or polygon.");
  }
  return feature?.type === "Feature"
    ? feature
    : { type: "Feature", properties: {}, geometry };
}
