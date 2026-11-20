<template>
  <ClientOnly>
    <v-btn variant="flat" color="primary" @click="open">
      <v-icon start>mdi-bug-outline</v-icon>
      Report a bug
    </v-btn>
    <v-dialog
      v-model="isOpen"
      max-width="640"
      scrollable
      :persistent="sending"
      aria-labelledby="bug-report-title"
    >
      <v-card>
        <v-card-title id="bug-report-title" class="pt-5 px-6"
          >Report a bug</v-card-title
        >
        <v-card-text>
          <div v-if="sentId" role="status">
            <p class="text-body-1">
              Thank you. Your report was sent to the SKOPE team.
            </p>
            <p class="mt-3">
              Report reference: <code>{{ sentId }}</code>
            </p>
            <v-btn class="mt-4" variant="text" @click="saveCopy"
              >Save a copy</v-btn
            >
          </div>
          <v-form
            v-else
            id="bug-report-form"
            ref="form"
            @submit.prevent="submit"
          >
            <p class="mb-5">
              Tell us what happened. We’ll attach details about this page so you
              don’t have to look them up.
            </p>
            <v-textarea
              v-model="message"
              label="What went wrong?"
              rows="4"
              required
              maxlength="8000"
              :disabled="sending"
              :rules="[requiredMessage]"
              autofocus
              hint="What did you do, what did you expect, and what happened? For numeric differences, include your reference values."
              persistent-hint
            />
            <v-text-field
              v-model="email"
              class="mt-4"
              label="Email (optional)"
              type="email"
              autocomplete="email"
              maxlength="254"
              :disabled="sending"
              :rules="[validEmail]"
              hint="Include this if you’d like us to follow up."
              persistent-hint
            />
            <v-file-input
              v-model="screenshot"
              class="mt-4"
              label="Screenshot (optional)"
              accept="image/png,image/jpeg,image/webp"
              :disabled="sending"
              :rules="[validScreenshot]"
              hint="PNG, JPEG or WebP, up to 5 MB. Check that it contains only information you want to share."
              persistent-hint
            />
            <template v-if="snapshot.studyArea">
              <v-checkbox
                v-model="includeArea"
                class="mt-3"
                label="Include my study area to help reproduce this problem"
                :disabled="sending"
                hide-details
              />
              <p class="text-body-2 mb-3">
                Uncheck to leave out the study area. Check screenshots
                separately for location details.
              </p>
            </template>
            <details>
              <summary>Review the details attached to your report</summary>
              <p class="text-body-2 mt-2">
                Captured when you opened this form. Includes browser, app
                version, dataset release, analysis settings and recent request
                IDs. Scientific result values are not attached.
              </p>
              <p v-if="loading" class="text-body-2 mt-2" role="status">
                Checking the API version…
              </p>
              <pre class="report-details mt-2 pa-3">{{ diagnostics }}</pre>
            </details>
            <v-alert
              v-if="error"
              type="error"
              variant="tonal"
              class="mt-4"
              role="alert"
            >
              {{ error }}
              <p v-if="image" class="mt-2">
                If you email a saved report, attach your screenshot separately.
              </p>
              <div class="mt-2">
                <v-btn variant="text" @click="saveCopy">Save a copy</v-btn> or
                <a href="mailto:skope-team@googlegroups.com"
                  >contact the SKOPE team</a
                >.
              </div>
            </v-alert>
          </v-form>
        </v-card-text>
        <v-card-actions class="px-6 pb-5">
          <v-spacer />
          <v-btn :disabled="sending" @click="isOpen = false">{{
            sentId ? "Close" : "Cancel"
          }}</v-btn>
          <v-btn
            v-if="!sentId"
            form="bug-report-form"
            type="submit"
            color="primary"
            variant="flat"
            :loading="sending"
            :disabled="loading || sending"
            >Send report</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
  </ClientOnly>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useBugReport } from "@/composables/useBugReport";
import {
  validReportScreenshot,
  reportJson,
  sendBugReport,
} from "@/utils/bugReport";

const { snapshot, loading, capture } = useBugReport();
const config = useRuntimeConfig();
const { buildId } = useAppConfig();
const isOpen = ref(false);
const sending = ref(false);
const message = ref("");
const email = ref("");
const screenshot = ref<File | File[] | null>(null);
const includeArea = ref(true);
const sentId = ref("");
const error = ref("");
const form = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const image = computed(() =>
  Array.isArray(screenshot.value)
    ? screenshot.value[0]
    : (screenshot.value ?? undefined),
);
const diagnostics = computed(() =>
  reportJson(snapshot.value, includeArea.value),
);
const requiredMessage = (value: string) =>
  !!value.trim() || "Describe the problem before sending.";
const validEmail = (value: string) =>
  !value.trim() ||
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ||
  "Enter an email address or leave this blank.";
const validScreenshot = () =>
  validReportScreenshot(image.value) ||
  "Choose a PNG, JPEG or WebP image up to 5 MB.";

function open() {
  isOpen.value = true;
  if (sentId.value) {
    sentId.value = "";
    message.value = "";
    email.value = "";
    screenshot.value = null;
    error.value = "";
  }
  // Preserve drafts and their original context if the form was closed unsent.
  if (!message.value && !email.value && !image.value) {
    includeArea.value = true;
    void capture();
  }
}

async function submit() {
  if (sending.value || loading.value || !(await form.value?.validate())?.valid)
    return;
  if (sending.value) return;
  sending.value = true;
  error.value = "";
  try {
    sentId.value = await sendBugReport({
      dsn: config.public.sentryDsn,
      message: message.value.trim(),
      email: email.value.trim(),
      diagnostics: diagnostics.value,
      buildId,
      page: String(snapshot.value.page),
      screenshot: image.value,
    });
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "Your report could not be sent. Save a copy and contact the SKOPE team.";
  } finally {
    sending.value = false;
  }
}

function saveCopy() {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          reportReference: sentId.value || undefined,
          message: message.value,
          email: email.value,
          diagnostics: JSON.parse(diagnostics.value),
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "skope-bug-report.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
</script>

<style scoped>
.report-details {
  max-height: 16rem;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.8125rem;
}
summary {
  cursor: pointer;
}
</style>
