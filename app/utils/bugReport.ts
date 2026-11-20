export function withoutStudyArea(request: Record<string, unknown> | null) {
  if (!request) return null;
  const { selected_area, ...settings } = request;
  return settings;
}

/** Strip GeoJSON properties and foreign members; retain only reproducible geometry. */
export function reportGeometry(value: unknown): unknown {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value))
    return value.map(reportGeometry).filter((geometry) => geometry != null);
  const area = value as Record<string, unknown>;
  if (area.type === "Feature") return reportGeometry(area.geometry);
  if (area.type === "FeatureCollection" || area.type === "GeometryCollection") {
    const members =
      area.type === "FeatureCollection" ? area.features : area.geometries;
    if (!Array.isArray(members)) return null;
    const geometries = members
      .map(reportGeometry)
      .filter((geometry) => geometry != null);
    if (area.type === "GeometryCollection")
      return { type: area.type, geometries };
    return geometries.length === 1
      ? geometries[0]
      : geometries.length
        ? geometries
        : null;
  }
  const knownTypes = [
    "Point",
    "MultiPoint",
    "LineString",
    "MultiLineString",
    "Polygon",
    "MultiPolygon",
  ];
  if (
    !knownTypes.includes(String(area.type)) ||
    !Array.isArray(area.coordinates)
  )
    return null;
  // Only numeric coordinate arrays belong in the attachment, even for a
  // malformed imported area. Never retain arbitrary foreign-member objects.
  const numericCoordinates = (entry: unknown): boolean =>
    Array.isArray(entry)
      ? entry.every(numericCoordinates)
      : typeof entry === "number" && Number.isFinite(entry);
  return numericCoordinates(area.coordinates)
    ? { type: area.type, coordinates: area.coordinates }
    : null;
}

export function reportJson(
  snapshot: Record<string, unknown>,
  includeArea: boolean,
) {
  const { studyArea, ...details } = snapshot;
  return JSON.stringify(
    {
      ...details,
      studyAreaIncluded: includeArea && studyArea != null,
      ...(includeArea && studyArea != null ? { studyArea } : {}),
    },
    null,
    2,
  );
}

export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function validReportScreenshot(file?: File): boolean {
  return (
    !file ||
    (SCREENSHOT_TYPES.includes(file.type) && file.size <= MAX_SCREENSHOT_BYTES)
  );
}

export async function sendBugReport(options: {
  dsn: string;
  message: string;
  email: string;
  diagnostics: string;
  buildId: string;
  page: string;
  screenshot?: File;
}): Promise<string> {
  if (!options.dsn) throw new Error("Bug reporting is not configured.");
  const attachments = [
    {
      filename: "skope-diagnostics.json",
      contentType: "application/json",
      data: new TextEncoder().encode(options.diagnostics),
    },
  ];
  if (attachments[0]!.data.byteLength > 2 * 1024 * 1024)
    throw new Error(
      "The study area is too large to attach. Remove it and try again.",
    );
  if (options.screenshot) {
    if (!validReportScreenshot(options.screenshot))
      throw new Error("Choose a PNG, JPEG or WebP image up to 5 MB.");
    attachments.push({
      filename: `screenshot.${options.screenshot.type.split("/")[1]}`,
      contentType: options.screenshot.type,
      data: new Uint8Array(await options.screenshot.arrayBuffer()),
    });
  }
  // A dedicated, feedback-only client avoids collecting replay, breadcrumbs,
  // request bodies or ambient user context alongside the reviewed attachment.
  let loadTimer: ReturnType<typeof setTimeout> | undefined;
  const sdk = await Promise.race([
    import("@sentry/nuxt"),
    new Promise<never>((_resolve, reject) => {
      loadTimer = setTimeout(
        () => reject(new Error("report service load timeout")),
        12_000,
      );
    }),
  ])
    .catch(() => {
      throw new Error(
        "The reporting service could not load. Your report is still here; try again or save a copy.",
      );
    })
    .finally(() => clearTimeout(loadTimer));
  const {
    BrowserClient,
    Scope,
    captureFeedback,
    defaultStackParser,
    makeFetchTransport,
  } = sdk;
  const client = new BrowserClient({
    dsn: options.dsn,
    transport: makeFetchTransport,
    stackParser: defaultStackParser,
    integrations: [],
    release: options.buildId,
    dataCollection: { userInfo: false },
  });
  client.init();
  const scope = new Scope();
  scope.setClient(client);
  scope.addEventProcessor((event) => ({
    ...event,
    user: undefined,
    breadcrumbs: [],
    request: { url: options.page },
    contexts: { feedback: event.contexts?.feedback },
  }));
  const reportId = crypto.randomUUID().replaceAll("-", "");
  let timer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe = () => {};
  try {
    await new Promise<void>((resolve, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(
              "We could not confirm delivery. Your report is still here; try again or save a copy.",
            ),
          ),
        12_000,
      );
      unsubscribe = client.on("afterSendEvent", (event, response) => {
        if (event.event_id !== reportId) return;
        if (
          response.statusCode != null &&
          response.statusCode >= 200 &&
          response.statusCode < 300
        )
          resolve();
        else
          reject(
            new Error(
              "The report was not accepted. Keep a copy and contact the SKOPE team.",
            ),
          );
      });
      captureFeedback(
        {
          message: options.message,
          email: options.email || undefined,
          url: options.page,
          tags: { source: "skope-report-form" },
        },
        { event_id: reportId, attachments, includeReplay: false },
        scope,
      );
    });
    return reportId;
  } finally {
    clearTimeout(timer);
    unsubscribe();
    void client.close(1000);
  }
}
