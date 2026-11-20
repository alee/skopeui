import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import MetadataDetail from "@/components/dataset/MetadataDetail.vue";
import type { Dataset } from "@/types/metadata";
import metadataFixture from "@/tests/fixtures/metadata-1.0.0.json";

const paleocar = metadataFixture.datasets[0] as Dataset;

function mountDetail(overrides: Partial<Dataset> = {}) {
  return mount(MetadataDetail, {
    props: { metadata: { ...paleocar, ...overrides } },
    global: {
      stubs: {
        VariableList: true,
        "v-card-text": { template: "<div><slot /></div>" },
      },
    },
  });
}

describe("MetadataDetail", () => {
  it("shows the uncertainty summary and the method summary", () => {
    const text = mountDetail().text();

    expect(text).toContain("Uncertainty");
    expect(text).toContain("There are two primary sources of uncertainty");
    expect(text).toContain("Method Summary");
    expect(text).toContain("PaleoCAR v3 differs from v2");
  });

  it("names the producers as originators", () => {
    const text = mountDetail().text();

    expect(text).toContain("Originator");
    expect(text).toContain("R. Kyle Bocinsky and Timothy A. Kohler");
    expect(text).not.toContain("SKOPE project");
  });

  it("links each publication's DOI", () => {
    const hrefs = mountDetail()
      .findAll("a")
      .map((a) => a.attributes("href"));

    expect(hrefs).toContain("https://doi.org/10.1038/ncomms6618");
    expect(hrefs).toContain("https://doi.org/10.1126/sciadv.1501532");
  });

  it("shows the license and the dataset's links", () => {
    const wrapper = mountDetail();

    expect(
      wrapper.get('a[href="https://spdx.org/licenses/CC-BY-4.0.html"]').text(),
    ).toBe("CC-BY-4.0");
    expect(wrapper.text()).toContain("NOAA NCEI paleoclimatology study 19783");
  });

  it("shows a custom license source once and leaves legacy other values readable", async () => {
    const href = "https://example.org/terms";
    const wrapper = mountDetail({
      license: "other",
      links: [{ rel: "license", href }],
    });
    expect(wrapper.get(`a[href="${href}"]`).text()).toBe(
      "See provider’s reuse terms",
    );
    expect(wrapper.findAll(`a[href="${href}"]`)).toHaveLength(1);
    await wrapper.setProps({
      metadata: { ...paleocar, license: "other", links: [] },
    });
    expect(wrapper.text()).toContain("Provider reuse terms (link unavailable)");
    expect(wrapper.find('a[href*="spdx.org"]').exists()).toBe(false);
  });

  it("leaves out sections the dataset doesn't have", () => {
    const text = mountDetail({
      uncertainty: null,
      lineage: null,
      publications: [],
      links: [],
    }).text();

    expect(text).not.toContain("Uncertainty");
    expect(text).not.toContain("Method Summary");
    expect(text).not.toContain("References");
    expect(text).not.toContain("Links");
  });
});
