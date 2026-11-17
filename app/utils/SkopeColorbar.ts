import type * as maplibregl from "maplibre-gl";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type ColorbarOptions = {
  colors: string[];
  /** The served display range, used unchanged (DISP-004). */
  range: [number, number];
  /** A tick count spread evenly over the range, or explicit tick values. */
  ticks: number | number[];
  units?: string;
};

/** The values a `ticks` entry puts on the legend, from the top down. */
export function tickValues(
  [vmin, vmax]: [number, number],
  ticks: number | number[],
): number[] {
  if (Array.isArray(ticks)) return [...ticks].sort((a, b) => b - a);
  if (ticks < 2) return [vmax, vmin];
  return Array.from(
    { length: ticks },
    (_, i) => vmax - (i / (ticks - 1)) * (vmax - vmin),
  );
}

function formatTick(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export class SkopeColorbar implements maplibregl.IControl {
  private _container: HTMLDivElement | null = null;
  private _options: ColorbarOptions;

  private static _idCounter = 0;
  private readonly _gradientId: string;

  private static readonly BAR_H = 140;
  private static readonly BAR_W = 16;
  private static readonly PAD = 6;

  constructor(options: ColorbarOptions) {
    this._options = options;
    this._gradientId = `skope-cmap-${SkopeColorbar._idCounter++}`;
  }

  onAdd(_map: maplibregl.Map): HTMLElement {
    this._container = document.createElement("div");
    this._container.className = "skope-colorbar maplibregl-ctrl";
    this._render();
    return this._container;
  }

  onRemove(): void {
    this._container?.remove();
    this._container = null;
  }

  update(options: ColorbarOptions): void {
    this._options = options;
    if (this._container) this._render();
  }

  show(): void {
    if (this._container) this._container.style.display = "";
  }

  hide(): void {
    if (this._container) this._container.style.display = "none";
  }

  private _render(): void {
    if (!this._container) return;
    const { BAR_H, BAR_W, PAD } = SkopeColorbar;
    const { colors, range, ticks, units } = this._options;
    const [vmin, vmax] = range;
    const svgH = BAR_H + PAD * 2;
    const tickX = BAR_W;
    const labelX = BAR_W + 6;
    const svgW = BAR_W + 52;

    const n = colors.length;
    const stops = colors
      .slice()
      .reverse()
      .map((c, i) => {
        const offset = n <= 1 ? "0.0" : ((i / (n - 1)) * 100).toFixed(1);
        return `<stop offset="${offset}%" stop-color="${escapeHtml(c)}"/>`;
      })
      .join("");

    const span = vmax - vmin || 1;
    const tickLines = tickValues(range, ticks)
      .map((v) => {
        const y = PAD + 0.5 + ((BAR_H - 1) * (vmax - v)) / span;
        return `
        <line x1="${tickX}" y1="${y.toFixed(1)}" x2="${tickX + 4}" y2="${y.toFixed(1)}"
              stroke="#666" stroke-width="1"/>
        <text x="${labelX}" y="${y.toFixed(1)}" dominant-baseline="middle"
              font-size="10" font-family="sans-serif" fill="#333">${formatTick(v)}</text>`;
      })
      .join("");

    this._container.innerHTML = `
      ${units ? `<div class="skope-colorbar__units">Units: ${escapeHtml(units)}</div>` : ""}
      <svg width="${svgW}" height="${svgH}" overflow="visible" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${this._gradientId}" x1="0" y1="0" x2="0" y2="1">
            ${stops}
          </linearGradient>
        </defs>
        <rect x="0" y="${PAD}" width="${BAR_W}" height="${BAR_H}"
              fill="url(#${this._gradientId})"/>
        ${tickLines}
      </svg>`;
  }
}
