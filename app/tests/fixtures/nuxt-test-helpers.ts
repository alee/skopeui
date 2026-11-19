import { vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, Suspense, type Component } from "vue";

export function installNuxtTestGlobals(options?: {
  asyncDataError?: unknown;
  nuxtApp?: Record<string, unknown>;
}) {
  const asyncDataMock = vi.fn(
    async (_key: unknown, handler?: () => unknown) => {
      const dataValue = typeof handler === "function" ? await handler() : null;
      return {
        data: { value: dataValue },
        error: { value: options?.asyncDataError ?? null },
      };
    },
  );

  vi.stubGlobal("definePageMeta", vi.fn());
  vi.stubGlobal("useHead", vi.fn());
  vi.stubGlobal("useAsyncData", asyncDataMock);
  vi.stubGlobal(
    "useNuxtApp",
    vi.fn(() => options?.nuxtApp ?? { $download: { saveAs: vi.fn() } }),
  );

  return { asyncDataMock };
}

export function resetNuxtTestGlobals() {
  vi.unstubAllGlobals();
}

export async function mountWithSuspense(
  component: Component,
  options: NonNullable<Parameters<typeof mount>[1]> = {},
) {
  const Root = defineComponent({
    name: "SuspenseTestRoot",
    render() {
      return h(Suspense, null, {
        default: () => h(component as any),
      });
    },
  });

  const wrapper = mount(Root, options);
  await flushPromises();
  await nextTick();
  return wrapper;
}
