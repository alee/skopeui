declare module "markdown-it-div" {
  import type { PluginSimple } from "markdown-it";
  const plugin: PluginSimple;
  export default plugin;
}

// Plotly ships its root types; the modular bundle uses the same public API.
declare module "plotly.js/lib/core" {
  import * as Plotly from "plotly.js";
  export = Plotly;
}

declare module "plotly.js/lib/scatter" {
  import type { PlotlyModule } from "plotly.js";
  const scatter: PlotlyModule;
  export default scatter;
}
