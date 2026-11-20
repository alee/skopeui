/** Validate imports before replacing the one active feature in browser storage. */
export function parseImportedStudyArea(value: unknown): unknown {
  const record = (entry: unknown): entry is Record<string, unknown> =>
    entry !== null && typeof entry === "object" && !Array.isArray(entry);
  if (!record(value)) throw new Error("Choose a GeoJSON point or polygon.");

  let feature = value;
  if (feature.type === "FeatureCollection") {
    if (!Array.isArray(feature.features) || feature.features.length !== 1)
      throw new Error("The file must contain exactly one study feature.");
    if (!record(feature.features[0]) || feature.features[0].type !== "Feature")
      throw new Error("The collection must contain a GeoJSON feature.");
    feature = feature.features[0];
  }
  const geometry = feature.type === "Feature" ? feature.geometry : feature;
  if (
    !record(geometry) ||
    (geometry.type !== "Point" && geometry.type !== "Polygon")
  )
    throw new Error("The study area must be one point or polygon.");

  const position = (entry: unknown): entry is number[] =>
    Array.isArray(entry) &&
    entry.length >= 2 &&
    entry.length <= 3 &&
    entry.every(
      (coordinate) =>
        typeof coordinate === "number" && Number.isFinite(coordinate),
    ) &&
    Math.abs(entry[0]) <= 180 &&
    Math.abs(entry[1]) <= 90;
  if (geometry.type === "Point") {
    if (!position(geometry.coordinates))
      throw new Error(
        "Use valid longitude (−180 to 180) and latitude (−90 to 90) coordinates.",
      );
  } else {
    const rings = geometry.coordinates;
    if (!Array.isArray(rings) || rings.length === 0)
      throw new Error("The study polygon must not be empty.");
    for (const ring of rings) {
      if (!Array.isArray(ring) || ring.length < 4 || !ring.every(position))
        throw new Error(
          "Each polygon ring needs at least four valid longitude/latitude positions.",
        );
      if (JSON.stringify(ring[0]) !== JSON.stringify(ring[ring.length - 1]))
        throw new Error("Each polygon ring must end at its starting position.");
      if (
        new Set(ring.map((point) => JSON.stringify(point.slice(0, 2)))).size < 3
      )
        throw new Error(
          "Each polygon ring needs at least three distinct positions.",
        );
    }
  }
  return feature.type === "Feature"
    ? feature
    : { type: "Feature", properties: {}, geometry };
}

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
