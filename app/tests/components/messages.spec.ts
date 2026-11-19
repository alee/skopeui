import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { describe, expect, it } from "vitest";

import Messages from "@/components/Messages.vue";
import { useMessagesStore } from "@/stores/messages";

describe("Messages", () => {
  it("styles each alert by its own type", () => {
    setActivePinia(createPinia());
    const store = useMessagesStore();
    store.error("Extraction failed");
    store.info("Heads up");

    const wrapper = mount(Messages, {
      global: {
        stubs: {
          "v-row": { template: "<div><slot /></div>" },
          "v-col": { template: "<div><slot /></div>" },
          "v-alert": {
            props: ["type", "color", "icon"],
            emits: ["click:close"],
            template:
              '<div class="alert" :data-type="type" :data-color="color" :data-icon="icon"><slot /><button class="close" @click="$emit(\'click:close\')" /></div>',
          },
        },
      },
    });

    const alerts = wrapper.findAll(".alert");
    expect(alerts.map((a) => a.attributes("data-type"))).toEqual([
      "error",
      "info",
    ]);
    expect(alerts.every((a) => a.attributes("data-color") == null)).toBe(true);
    expect(alerts[0]!.attributes("data-icon")).toBe("mdi-alert-circle");
  });

  it("dismisses the alert whose close button was clicked", async () => {
    setActivePinia(createPinia());
    const store = useMessagesStore();
    store.error("first");
    store.error("second");

    const wrapper = mount(Messages, {
      global: {
        stubs: {
          "v-row": { template: "<div><slot /></div>" },
          "v-col": { template: "<div><slot /></div>" },
          "v-alert": {
            emits: ["click:close"],
            template:
              '<div class="alert"><slot /><button class="close" @click="$emit(\'click:close\')" /></div>',
          },
        },
      },
    });
    await wrapper.findAll(".close")[0]!.trigger("click");

    expect(store.messages.map((m) => m.message)).toEqual(["second"]);
  });
});
