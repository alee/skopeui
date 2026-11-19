import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { reactive, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DefaultLayout from "@/layouts/default.vue";
import { useMessagesStore } from "@/stores/messages";

const route = reactive({ path: "/dataset/paleocar_v3" });
let navigationFinished: (
  to: { path: string },
  from: { path: string },
  failure?: unknown,
) => void;
const unsubscribe = vi.fn();
vi.mock("vuetify", () => ({ useDisplay: () => ({ mdAndUp: ref(true) }) }));

beforeEach(() => {
  setActivePinia(createPinia());
  unsubscribe.mockClear();
  route.path = "/dataset/paleocar_v3";
  vi.stubGlobal("useRoute", () => route);
  vi.stubGlobal("useRouter", () => ({
    afterEach: (hook: typeof navigationFinished) => {
      navigationFinished = hook;
      return unsubscribe;
    },
  }));
});
afterEach(() => vi.unstubAllGlobals());

function mountLayout() {
  return mount(DefaultLayout, {
    global: {
      stubs: {
        "v-app": { template: "<div><slot /></div>" },
        "v-main": { template: "<div><slot /></div>" },
        "v-container": { template: "<div><slot /></div>" },
        Header: true,
        Navigation: true,
        StepBar: true,
        PageLoadingOverlay: true,
        Messages: true,
        Footer: true,
        NuxtPage: true,
      },
    },
  });
}

describe("default layout", () => {
  it("clears old messages at commit while keeping messages for the page being opened", async () => {
    const wrapper = mountLayout();
    const messages = useMessagesStore();
    messages.error("Old extraction failed");
    messages.info("Draw an area first", { keepOnNavigation: true });
    const nextPath = "/dataset/paleocar_v3/visualize/ppt_annual";
    navigationFinished({ path: nextPath }, { path: route.path });
    expect(messages.messages.map((message) => message.message)).toEqual([
      "Draw an area first",
    ]);
    messages.error("The new page's request failed");
    route.path = nextPath; // Nuxt publishes the page route after setup.
    await flushPromises();
    expect(messages.messages.map((message) => message.message)).toEqual([
      "Draw an area first",
      "The new page's request failed",
    ]);
    wrapper.unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("keeps messages for canceled navigation and query-only changes", () => {
    const wrapper = mountLayout();
    const messages = useMessagesStore();
    messages.error("Current page's message");
    navigationFinished(
      { path: "/other" },
      { path: route.path },
      new Error("canceled"),
    );
    navigationFinished({ path: route.path }, { path: route.path });
    expect(messages.messages).toHaveLength(1);
    wrapper.unmount();
  });
});
