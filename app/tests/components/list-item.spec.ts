import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { Dataset } from "@/types/metadata";
import ListItem from "@/components/dataset/ListItem.vue";
import metadataFixture from "@/tests/fixtures/metadata-1.0.0.json";

vi.mock("@/components/dataset/DatasetMapPreview.client.vue", () => ({
  default: {
    name: "DatasetMapPreview",
    props: ["bbox", "mapView", "title"],
    template: '<div data-test="preview" />',
  },
}));

const paleocar = metadataFixture.datasets[0]! as Dataset;

function mountListItem(overrides: Partial<Dataset> = {}) {
  return mount(ListItem, {
    props: { dataset: { ...paleocar, ...overrides } },
    global: {
      stubs: {
        "client-only": { template: "<div><slot /></div>" },
        NuxtLink: { props: ["to"], template: '<a :href="to"><slot /></a>' },
        MetadataModal: true,
        "v-list-item": {
          props: ["title"],
          template: '<div><slot name="prepend" />{{ title }}</div>',
        },
      },
    },
  });
}

describe("ListItem", () => {
  it("renders sanitized descriptions and updates them when the dataset changes", async () => {
    const wrapper = mountListItem({
      description:
        '**Description** <img src="https://example.test/map.png" onerror="alert(1)"><script>alert(1)</script>',
    });
    const description = wrapper.get(".list-item-description");
    expect(description.find("strong").text()).toBe("Description");
    expect(description.find("img").attributes("onerror")).toBeUndefined();
    expect(description.find("script").exists()).toBe(false);
    await wrapper.setProps({
      dataset: { ...paleocar, description: "<em>Updated</em>" },
    });
    expect(description.find("em").text()).toBe("Updated");
    wrapper.unmount();
  });

  it("shows the region, resolution and time coverage", () => {
    const text = mountListItem().text();

    expect(text).toContain("Southwestern USA at 30 arc-second (~830 m)");
    expect(text).toContain("103–2000 CE, annual");
  });

  it("lists variables by title with their category", () => {
    const text = mountListItem().text();

    expect(text).toContain("Annual (Jan–Dec) Precipitation");
    expect(text).toContain("Growing Degree Days");
  });

  it("links the source from the dataset's via link", () => {
    const link = mountListItem().find('a[target="_blank"]');

    expect(link.attributes("href")).toBe(
      "https://www.ncei.noaa.gov/access/paleo-search/study/19783",
    );
    expect(link.text()).toBe("NOAA NCEI paleoclimatology study 19783");
  });

  it("leaves out the source line without a via link", () => {
    expect(mountListItem({ links: [] }).text()).not.toContain("Source:");
  });
  it("passes the advertised viewport to the dataset preview", () => {
    const wrapper = mountListItem();
    const preview = wrapper.findComponent({ name: "DatasetMapPreview" });
    expect(wrapper.find(".list-item-map-link").attributes("href")).toBe(
      "/dataset/paleocar_v3",
    );
    expect(preview.element.closest("a")).toBeNull();
    expect(preview.props()).toMatchObject({
      bbox: paleocar.bbox,
      mapView: paleocar.map_view,
      title: paleocar.title,
    });
  });
});
