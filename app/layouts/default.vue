<template>
  <v-app>
    <Header />
    <Navigation />
    <v-main>
      <v-container fluid>
        <StepBar v-if="mdAndUp" />
        <Messages />
        <div class="page-area">
          <UpdateRequired v-if="metadataStore.updateRequired" />
          <NuxtPage v-else />
          <PageLoadingOverlay />
        </div>
      </v-container>
    </v-main>
    <div class="mt-6">
      <Footer />
    </div>
  </v-app>
</template>

<script setup lang="ts">
import Header from "@/components/Header.vue";
import Navigation from "@/components/Navigation.vue";
import StepBar from "@/components/StepBar.vue";
import PageLoadingOverlay from "@/components/PageLoadingOverlay.vue";
import Messages from "@/components/Messages.vue";
import Footer from "@/components/Footer.vue";
import UpdateRequired from "@/components/UpdateRequired.vue";
import { onScopeDispose } from "vue";
import { useDisplay } from "vuetify";
import { useMessagesStore } from "@/stores/messages";
import { useMetadataStore } from "@/stores/metadata";

const router = useRouter();
const { mdAndUp } = useDisplay();
const messagesStore = useMessagesStore();
const metadataStore = useMetadataStore();

// Clear at navigation commit, before the next page can raise messages. Nuxt's
// route snapshot updates later, after that page is displayed.
const removeNavigationHook = router.afterEach((to, from, failure) => {
  if (!failure && to.path !== from.path) messagesStore.clearOnNavigation();
});
onScopeDispose(removeNavigationHook);
</script>

<style scoped>
/* Holds the loading overlay over the page. Tall enough for it even when the
   page being left has already cleared. */
.page-area {
  position: relative;
  min-height: 50vh;
}
</style>
