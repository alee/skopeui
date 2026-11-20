export type RequestDiagnostic = {
  at: string;
  operation: string;
  status?: number;
  requestId?: string;
  errorCode?: string;
};

// Per-tab, memory-only support history. Never retain bodies, keys or raw URLs.
const recent: RequestDiagnostic[] = [];

export function recordRequestDiagnostic(
  url: string,
  details: Omit<RequestDiagnostic, "at" | "operation">,
) {
  if (typeof window === "undefined") return;
  let path: string;
  try {
    path = new URL(url, window.location.origin).pathname;
  } catch {
    return;
  }
  const operation = path.endsWith("/timeseries/extract")
    ? "extract"
    : path.endsWith("/timeseries/analyze")
      ? "analyze"
      : /\/timeseries\/status\/[^/]+$/.test(path)
        ? "status"
        : path.endsWith("/metadata")
          ? "metadata"
          : path.endsWith("/version")
            ? "version"
            : "api";
  recent.push({ at: new Date().toISOString(), operation, ...details });
  if (recent.length > 20) recent.shift();
}

export function requestDiagnostics() {
  return recent.map((entry) => ({ ...entry }));
}
