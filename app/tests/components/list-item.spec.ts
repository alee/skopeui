import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import ListItem from "@/components/dataset/ListItem.vue";
import metadataFixture from "@/tests/fixtures/metadata-1.0.0.json";

vi.mock("@/components/dataset/DatasetMapPreview.client.vue", () => ({
  default: {
    name: "DatasetMapPreview",
    props: ["bbox", "mapView", "title"],
    template: '<div data-test="preview" />',
  },
}));

const paleocar = metadataFixture.datasets[0]!;

function mountListItem(overrides: Record<string, unknown> = {}) {
  return mount(ListItem, {
    props: { ...paleocar, ...overrides } as any,
    global: {
      mocks: { $md: { render: (text: string) => text } },
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
