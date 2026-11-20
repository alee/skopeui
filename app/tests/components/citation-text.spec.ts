import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import CitationText from "@/components/CitationText.vue";

function mountCitation() {
  return mount(CitationText, {
    props: { label: "Example citation", text: "SKOPE citation text" },
    global: {
      stubs: {
        "v-textarea": true,
        "v-btn": { template: "<button><slot /></button>" },
      },
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("citation copying", () => {
  it("copies the supplied citation and announces success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const wrapper = mountCitation();
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith("SKOPE citation text");
    expect(wrapper.get('[role="status"]').text()).toBe(
      "Example citation copied to clipboard.",
    );
  });

  it.each([
    undefined,
    { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
  ])(
    "offers manual copying when clipboard access is unavailable or denied: %s",
    async (clipboard) => {
      vi.stubGlobal("navigator", { clipboard });
      const wrapper = mountCitation();
      await wrapper.get("button").trigger("click");
      await flushPromises();
      expect(wrapper.get('[role="status"]').text()).toContain(
        "Select the text above and copy it.",
      );
    },
  );
});
