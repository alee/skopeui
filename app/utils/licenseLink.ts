import type { Dataset } from "@/types/metadata";

/** Keep license destinations here so the UI can change providers independently. */
export function licenseLink(
  dataset: Pick<Dataset, "license" | "links">,
): string | null {
  // Newly built releases require one listed SPDX identifier or `other` with a
  // source link. Older overviews can lack that link; retain their plain text.
  if (dataset.license === "other") {
    return (
      dataset.links.find(
        (link) => link.rel === "license" && link.href.startsWith("https://"),
      )?.href ?? null
    );
  }
  return `https://spdx.org/licenses/${encodeURIComponent(dataset.license)}.html`;
}
