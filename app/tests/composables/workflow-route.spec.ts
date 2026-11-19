import { afterEach, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { useWorkflowSteps } from "@/composables/useWorkflowSteps";

const immediate = vi.hoisted(() => ({ route: {} as Record<string, unknown> }));
vi.mock("vue-router", () => ({ useRoute: () => immediate.route }));
afterEach(() => vi.unstubAllGlobals());

it("keeps workflow links on Nuxt's route until Nuxt publishes the next page", () => {
  setActivePinia(createPinia());
  const current = { name: "dataset-id", params: { id: "paleocar_v3" } };
  const nuxtRoute = reactive({ ...current });
  const routerRoute = reactive({ ...current });
  immediate.route = routerRoute;
  vi.stubGlobal("useRoute", () => nuxtRoute);
  const workflow = useWorkflowSteps();
  routerRoute.name = "dataset-id-analyze-variable";
  routerRoute.params = { id: "other" };
  expect(workflow.currentStepIndex.value).toBe(1);
  expect(workflow.locations.value[1]).toMatchObject({
    params: { id: "paleocar_v3" },
  });
  nuxtRoute.name = routerRoute.name;
  nuxtRoute.params = routerRoute.params;
  expect(workflow.currentStepIndex.value).toBe(3);
  expect(workflow.locations.value[1]).toMatchObject({
    params: { id: "other" },
  });
});
