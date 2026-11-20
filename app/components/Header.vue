<template>
  <!-- Tall enough for the title and subtitle; at 64px the title was cut. -->
  <v-app-bar src="/header.png" height="80">
    <template #image>
      <v-img src="/header.png" alt="" aria-hidden="true" cover />
    </template>
    <!-- Wider screens show the steps in the step bar instead. -->
    <v-app-bar-nav-icon
      v-if="!mdAndUp"
      class="workflow-toggle"
      aria-label="Open workflow navigation"
      @click.stop="toggleNavigationDrawer()"
    >
      <v-icon color="primary" x-large>mdi-menu</v-icon>
    </v-app-bar-nav-icon>
    <v-app-bar-title class="skope-brand">
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
    <v-spacer />
    <nav class="header-actions" aria-label="Help and tools">
      <LoadAnalysis v-if="mdAndUp" />
      <template v-if="lgAndUp">
        <v-btn
          v-for="link in helpLinks"
          :key="link.label"
          :href="link.url"
          :target="link.external ? '_blank' : undefined"
          :rel="link.external ? 'noopener noreferrer' : undefined"
          color="primary"
          variant="flat"
          :prepend-icon="link.icon"
        >
          {{ link.label }}
        </v-btn>
      </template>
      <v-menu v-else>
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            icon="mdi-help-circle-outline"
            class="help-menu-toggle"
            variant="flat"
            aria-label="Help and contact"
            color="primary"
          />
        </template>
        <v-list>
          <v-list-item
            v-for="link in helpLinks"
            :key="link.label"
            :href="link.url"
            :target="link.external ? '_blank' : undefined"
            :rel="link.external ? 'noopener noreferrer' : undefined"
            :prepend-icon="link.icon"
            :title="link.label"
          />
        </v-list>
      </v-menu>
      <BugReport />
    </nav>
  </v-app-bar>
</template>
<script setup lang="ts">
import { useDisplay } from "vuetify";
import LoadAnalysis from "@/components/dataset/LoadAnalysis.vue";
import BugReport from "@/components/BugReport.vue";
import { useAppStore } from "@/stores/app";

const appStore = useAppStore();
// Destructured: a ref read through the object stays truthy in the template.
const { mdAndUp, lgAndUp } = useDisplay();
const helpLinks = [
  {
    label: "User Guide",
    icon: "mdi-help-circle-outline",
    url: "https://www.openskope.org/skope-users-guide/",
    external: true,
  },
  {
    label: "Contact",
    icon: "mdi-email-outline",
    url: "mailto:skope-team@googlegroups.com",
    external: false,
  },
];

function toggleNavigationDrawer() {
  appStore.toggleNavigationDrawer();
}
</script>
<style lang="scss" scoped>
.skope-brand {
  flex: 0 1 auto;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-inline-end: 16px;
  flex-shrink: 0;
}

// Explicit typography also covers buttons rendered by the two child components.
.header-actions :deep(.v-btn) {
  font-family: "Roboto", sans-serif;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25rem;
  letter-spacing: 0.1px;
  text-transform: none;
  border-radius: 4px;
}

.header-actions :deep(.v-btn:focus-visible) {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 3px;
}

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

@media (min-width: 600px) and (max-width: 959px) {
  .skope-title {
    font-size: 1.75rem;
  }

  .skope-subtitle {
    font-size: 1rem;
  }
}

@media (max-width: 599px) {
  .workflow-toggle {
    width: 40px;
    margin-inline: 4px;
  }

  .skope-brand {
    margin-inline-start: 4px;
  }

  .help-menu-toggle {
    width: 40px;
  }

  .skope-subtitle {
    display: none;
  }

  .skope-title {
    font-size: 1.5rem;
  }

  .header-actions {
    gap: 4px;
    padding-inline-end: 8px;
  }
}

@media (max-width: 359px) {
  .skope-title {
    font-size: 1.25rem;
  }
}
</style>
