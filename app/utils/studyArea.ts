/** Whether GeoJSON contains drawable geometry; API validation remains separate. */
export function hasStudyArea(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const area = value as Record<string, unknown>;
  if (area.type === "Feature") return hasStudyArea(area.geometry);
  if (area.type === "FeatureCollection")
    return Array.isArray(area.features) && area.features.some(hasStudyArea);
  if (area.type === "GeometryCollection")
    return Array.isArray(area.geometries) && area.geometries.some(hasStudyArea);

  const position = (entry: unknown): boolean =>
    Array.isArray(entry) &&
    entry.length >= 2 &&
    entry.every(
      (coordinate) =>
        typeof coordinate === "number" && Number.isFinite(coordinate),
    );
  const line = (entry: unknown): boolean =>
    Array.isArray(entry) && entry.length >= 2 && entry.every(position);
  const polygon = (entry: unknown): boolean =>
    Array.isArray(entry) &&
    entry.some(
      (ring) => Array.isArray(ring) && ring.length >= 4 && ring.every(position),
    );
  const coordinates = area.coordinates;
  switch (area.type) {
    case "Point":
      return position(coordinates);
    case "MultiPoint":
      return Array.isArray(coordinates) && coordinates.some(position);
    case "LineString":
      return line(coordinates);
    case "MultiLineString":
      return Array.isArray(coordinates) && coordinates.some(line);
    case "Polygon":
      return polygon(coordinates);
    case "MultiPolygon":
      return Array.isArray(coordinates) && coordinates.some(polygon);
    default:
      return false;
  }
}
