<template>
  <!-- footer -->
  <v-footer color="footer" class="site-footer">
    <v-card variant="flat" color="footer" class="footer-content text-center">
      <v-card-text class="text-white text-subtitle-1">
        This material is based upon work supported by the National Science
        Foundation under Grant Nos. SMA 1439591 and 1637189 to Arizona State
        University, SMA 1439603 and 1637155 to the University of Illinois at
        Urbana-Champaign, and SMA 1439516 and 1637171 to Washington State
        University.
      </v-card-text>
      <!-- Resource acknowledgment guidance:
           https://docs.alliancecan.ca/wiki/Acknowledging_the_Alliance
           https://www.uvic.ca/systems/researchcomputing/about-us/index.php#acknowledgements -->
      <v-card-text class="text-white text-subtitle-1 pt-0">
        This research was enabled in part by support provided by
        <a
          class="text-white"
          href="https://www.uvic.ca/systems/researchcomputing/"
          target="_blank"
          rel="noopener noreferrer"
          >Research Computing Services at the University of Victoria</a
        >
        and the
        <a
          class="text-white"
          href="https://alliancecan.ca/"
          target="_blank"
          rel="noopener noreferrer"
          >Digital Research Alliance of Canada</a
        >. Computing resources are provided through the Alliance’s Research
        Platforms and Portals program.
      </v-card-text>
      <v-divider />
      <span class="text-subtitle-1 text-white">
        &copy; 2016-{{ new Date().getFullYear() }} Synthesizing Knowledge of
        Past Environments (SKOPE)
      </span>
      <Citation />
      <TermsOfUse />
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

const { buildId } = useAppConfig();
const github = {
  id: "github",
  label: "GitHub",
  icon: "mdi-github",
  url: "https://github.com/openskope/skopeui/",
};
</script>

<style scoped>
.site-footer {
  justify-content: center;
}

.footer-content {
  width: 100%;
  max-width: 1280px;
  margin-inline: auto;
}
</style>
