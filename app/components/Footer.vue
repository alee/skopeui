<template>
  <!-- footer -->
  <v-footer color="footer">
    <v-card variant="flat" color="footer" class="text-center">
      <v-card-text class="text-white text-subtitle-1">
        This material is based upon work supported by the National Science
        Foundation under Grant Nos. SMA 1439591 and 1637189 to Arizona State
        University, SMA 1439603 and 1637155 to the University of Illinois at
        Urbana-Champaign, and SMA 1439516 and 1637171 to Washington State
        University.
      </v-card-text>
      <v-divider />
      <span class="text-subtitle-1 text-white">
        &copy; 2016-{{ new Date().getFullYear() }} Synthesizing Knowledge of
        Past Environments (SKOPE)
      </span>
      <Citation />
      <TermsOfUse />
      <BugReport />
      <v-btn
        v-for="link in links"
        :key="link.id"
        variant="plain"
        color="white"
        class="text-subtitle-1"
        target="_blank"
        :href="link.url"
      >
        <v-icon start>{{ link.icon }}</v-icon>
        {{ link.label }}
      </v-btn>
      <v-btn
        color="white"
        class="text-subtitle-1"
        variant="plain"
        target="_blank"
        :href="github.url"
      >
        <v-icon start>{{ github.icon }}</v-icon>
        Build: {{ buildId }}
      </v-btn>
    </v-card>
  </v-footer>
  <!-- end footer -->
</template>

<script setup lang="ts">
import TermsOfUse from "@/components/TermsOfUse.vue";
import Citation from "@/components/Citation.vue";
import BugReport from "@/components/BugReport.vue";

const { buildId } = useAppConfig();
const github = {
  id: "github",
  label: "GitHub",
  icon: "mdi-github",
  url: "https://github.com/openskope/skopeui/",
};
const links = [
  {
    id: "docs",
    label: "User Guide",
    icon: "mdi-help-circle-outline",
    url: "https://www.openskope.org/skope-users-guide/",
  },
  {
    id: "contact",
    label: "Contact",
    icon: "mdi-email",
    url: "mailto: skope-team@googlegroups.com",
  },
];
</script>
