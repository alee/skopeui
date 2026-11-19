import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PageLoadingOverlay from "@/components/PageLoadingOverlay.vue";

const hooks: Record<string, () => void> = {};

function mountOverlay() {
  return mount(PageLoadingOverlay, {
    global: {
      stubs: {
        "v-overlay": {
          props: ["modelValue"],
          template:
            '<div data-test="page-loading" :data-visible="String(modelValue)"><slot /></div>',
        },
        "v-progress-circular": true,
      },
    },
  });
}

describe("PageLoadingOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("useNuxtApp", () => ({
      hook: (name: string, fn: () => void) => {
        hooks[name] = fn;
        return () => delete hooks[name];
      },
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows only when the next page takes longer than half a second", async () => {
    const wrapper = mountOverlay();
    const visible = () =>
      wrapper.find('[data-test="page-loading"]').attributes("data-visible");

    hooks["page:loading:start"]!();
    await vi.advanceTimersByTimeAsync(400);
    expect(visible()).toBe("false");
    hooks["page:loading:end"]!();
    await vi.advanceTimersByTimeAsync(400);
    expect(visible()).toBe("false");

    hooks["page:loading:start"]!();
    await vi.advanceTimersByTimeAsync(600);
    expect(visible()).toBe("true");
    hooks["page:loading:end"]!();
    await vi.advanceTimersByTimeAsync(0);
    expect(visible()).toBe("false");
  });
});
