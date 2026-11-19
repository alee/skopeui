import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import VariableList from "@/components/dataset/VariableList.vue";
import type { Variable } from "@/types/metadata";

function variable(id: string, category: string | null): Variable {
  return { id, title: `Title of ${id}`, category } as Variable;
}

function mountList(variables: Variable[]) {
  return mount(VariableList, {
    props: { variables },
    global: {
      stubs: {
        "v-list": { template: "<div><slot /></div>" },
        "v-list-subheader": { template: "<div><slot /></div>" },
        "v-chip": { template: "<span><slot /></span>" },
        "v-list-group": {
          template:
            '<section class="group"><slot name="activator" :props="{}" /><slot /></section>',
        },
        "v-list-item": {
          props: ["title"],
          template:
            '<div class="item"><slot name="prepend" /> {{ title }}</div>',
        },
      },
    },
  });
}

function groupSummaries(wrapper: ReturnType<typeof mountList>) {
  return wrapper
    .findAll(".group")
    .map((group) => group.find(".item").text().replace(/\s+/g, " "));
}

describe("VariableList", () => {
  it("groups variables by category, in the order they arrive", () => {
    const wrapper = mountList([
      variable("ppt_annual", "Precipitation"),
      variable("gdd_cotton_annual", "Growing Degree Days"),
      variable("ppt_may_sept", "Precipitation"),
    ]);

    expect(groupSummaries(wrapper)).toEqual([
      "Precipitation 2 variables",
      "Growing Degree Days 1 variable",
    ]);
    expect(wrapper.findAll(".group")[0]!.text()).toContain(
      "Title of ppt_may_sept",
    );
  });

  it("puts variables without a category under Other, last", () => {
    const wrapper = mountList([
      variable("unsorted", null),
      variable("ppt_annual", "Precipitation"),
    ]);

    expect(groupSummaries(wrapper)).toEqual([
      "Precipitation 1 variable",
      "Other 1 variable",
    ]);
  });
});
