export interface ExportTrace {
  name?: unknown;
  x?: unknown;
  y?: unknown;
}
export interface PlotImageApi {
  toImages(expectedData?: ExportTrace[]): Promise<{ svg: string; png: string }>;
}
export interface TimeSeriesPlotApi {
  getTimeSeriesPlotImage(
    expectedData?: ExportTrace[],
  ): Promise<{ svg: string; png: string }>;
}
