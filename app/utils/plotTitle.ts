/**
 * Splits a title longer than `maxLineLength` into two Plotly lines, at the
 * space nearest its middle. A title with no space stays on one line.
 */
export function wrapPlotTitle(title: string, maxLineLength: number): string {
  if (title.length <= maxLineLength) return title;
  const middle = title.length / 2;
  let split = -1;
  for (let i = 0; i < title.length; i++) {
    if (
      title[i] === " " &&
      (split < 0 || Math.abs(i - middle) < Math.abs(split - middle))
    ) {
      split = i;
    }
  }
  if (split < 0) return title;
  return `${title.slice(0, split)}<br>${title.slice(split + 1)}`;
}

/** Wrap narrow chart labels without truncating long identifiers. */
export function wrapPlotLabel(title: string, maxLineLength: number): string {
  const limit = Math.max(1, Math.floor(maxLineLength));
  const lines: string[] = [];
  let line = "";
  for (const word of title.split(/\s+/)) {
    if (!word) continue;
    if (line && line.length + word.length + 1 > limit) {
      lines.push(line);
      line = "";
    }
    let remainder = word;
    while (remainder.length > limit) {
      lines.push(remainder.slice(0, limit));
      remainder = remainder.slice(limit);
    }
    line = line ? `${line} ${remainder}` : remainder;
  }
  if (line) lines.push(line);
  return lines.join("<br>");
}
