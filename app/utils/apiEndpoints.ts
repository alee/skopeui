/** Resolve paths once for the API configured for this app instance. */
export function createApiEndpoints(apiBase: string) {
  const base = apiBase.replace(/\/+$/, "");
  return {
    metadata: `${base}/metadata`,
    tiles: `${base}/tiles`,
    extract: `${base}/timeseries/extract`,
    status: `${base}/timeseries/status`,
    analyze: `${base}/timeseries/analyze`,
  };
}
