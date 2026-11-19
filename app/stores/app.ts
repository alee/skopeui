import { defineStore } from "pinia";

type AppStep = {
  id: number;
  name: string;
  label: string;
  icon: string;
};

const steps: AppStep[] = [
  { id: 1, name: "index", label: "Select Dataset", icon: "mdi-database" },
  { id: 2, name: "dataset-id", label: "Select Area", icon: "mdi-map-marker" },
  {
    id: 3,
    name: "dataset-id-visualize-variable",
    label: "Visualize",
    icon: "mdi-map-clock-outline",
  },
  {
    id: 4,
    name: "dataset-id-analyze-variable",
    label: "Analyze",
    icon: "mdi-chart-line",
  },
];

export const useAppStore = defineStore("app", {
  // The steps are fixed, so they aren't state: state is serialized into the
  // server-rendered page, which then outranks the client's own copy.
  state: () => ({
    isNavigationVisible: false,
    isFirstVisit: true,
  }),
  getters: {
    steps: () => steps,
    stepNames: () => steps.map((step) => step.name),
  },
  actions: {
    setNavigationVisible(value: boolean) {
      this.isNavigationVisible = value;
    },
    setVisited() {
      this.isFirstVisit = false;
    },
    toggleNavigationDrawer() {
      this.isNavigationVisible = !this.isNavigationVisible;
    },
  },
});
