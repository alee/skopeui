<template>
  <!-- Tall enough for the title and subtitle; at 64px the title was cut. -->
  <v-app-bar src="/header.png" height="80">
    <template #image>
      <v-img src="/header.png" alt="" aria-hidden="true" cover />
    </template>
    <!-- Wider screens show the steps in the step bar instead. -->
    <v-app-bar-nav-icon
      v-if="!mdAndUp"
      aria-label="Open workflow navigation"
      @click.stop="toggleNavigationDrawer()"
    >
      <v-icon color="primary" x-large>mdi-menu</v-icon>
    </v-app-bar-nav-icon>
    <v-app-bar-title>
      <a
        class="skope-title pa-0 ma-0"
        href="https://www.openskope.org"
        target="_blank"
      >
        SKOPE
      </a>
      <div class="skope-subtitle">
        Synthesizing Knowledge of Past Environments
      </div>
    </v-app-bar-title>
    <template v-if="mdAndUp">
      <v-spacer />
      <LoadAnalysis />
    </template>
  </v-app-bar>
</template>
<script setup lang="ts">
import { useDisplay } from "vuetify";
import LoadAnalysis from "@/components/dataset/LoadAnalysis.vue";
import { useAppStore } from "@/stores/app";

const appStore = useAppStore();
// Destructured: a ref read through the object stays truthy in the template.
const { mdAndUp } = useDisplay();

function toggleNavigationDrawer() {
  appStore.toggleNavigationDrawer();
}
</script>
<style lang="scss" scoped>
.skope-title {
  text-decoration: none;
  color: rgb(var(--v-theme-brand));
  font-family: $skope-title-font;
  font-weight: bold;
  font-size: 2.3em;
  line-height: 1.1;
}

.skope-subtitle {
  color: rgb(var(--v-theme-primary));
  font-family: $skope-title-font;
  font-weight: bolder;
  font-size: 1.2rem;
  line-height: 1.2;
  white-space: normal;
}

@media (max-width: 599px) {
  .skope-subtitle {
    font-size: 0.875rem;
  }
}
</style>
