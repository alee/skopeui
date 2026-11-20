import { describe, expect, it } from "vitest";
import { licenseLink } from "@/utils/licenseLink";

describe("license destinations", () => {
  it("uses SPDX for a standard identifier", () => {
    expect(licenseLink({ license: "CC-BY-4.0", links: [] })).toBe(
      "https://spdx.org/licenses/CC-BY-4.0.html",
    );
  });

  it("uses the declared source for other licenses", () => {
    const href = "https://example.org/data-terms";
    expect(
      licenseLink({ license: "other", links: [{ rel: "license", href }] }),
    ).toBe(href);
  });

  it("keeps legacy other licenses without a source unlinked", () => {
    expect(licenseLink({ license: "other", links: [] })).toBeNull();
    expect(
      licenseLink({
        license: "other",
        links: [{ rel: "license", href: "javascript:alert(1)" }],
      }),
    ).toBeNull();
  });
});
