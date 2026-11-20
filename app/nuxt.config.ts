import { THEME_COLORS } from "./utils/colors";

export default defineNuxtConfig({
  compatibilityDate: "2025-01-15",
  devtools: { enabled: process.env.NODE_ENV !== "production" },
  // Keep the existing source layout when using Nuxt 4.
  srcDir: ".",
  dir: { app: "app" },
  buildDir: ".nuxt",

  nitro: {
    output: {
      dir: ".output",
    },
  },

  plugins: ["~/plugins/download.client.ts"],

  modules: [
    "@pinia/nuxt",
    "vuetify-nuxt-module",
    "@nuxtjs/robots",
    "nuxt-gtag",
    "@sentry/nuxt",
  ],

  app: {
    head: {
      title: "skopeui",
      htmlAttrs: { lang: "en" },
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content: "Skope dataset discovery, visualization, and analysis.",
        },
      ],
      link: [
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css?family=Roboto:300,400,500,700",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css?family=Bitter:400,700",
        },
      ],
    },
  },

  appConfig: {
    buildId: process.env.SKOPE_BUILD_ID || "development",
  },

  runtimeConfig: {
    sentry: {
      dsn:
        process.env.NUXT_SENTRY_DSN ||
        "https://9b9dc2f60562380edeb675c39fe1c896@sentry.comses.net/4",
    },
    public: {
      apiBase: "http://localhost:8001",
      // A Sentry DSN is a public ingestion address, not an account credential.
      sentryDsn:
        process.env.NUXT_SENTRY_DSN ||
        "https://9b9dc2f60562380edeb675c39fe1c896@sentry.comses.net/4",
      gtagId: process.env.NUXT_PUBLIC_GTAG_ID || "G-M0NVBT90BT",
      cartoApiKey: "",
      stadiaApiKey: "",
      stadiaDomainAuth: true,
    },
  },

  gtag: {
    id: process.env.NUXT_PUBLIC_GTAG_ID || "G-M0NVBT90BT",
    enabled: process.env.NODE_ENV === "production",
  },

  robots: {
    enabled: true,
  },

  sentry: {
    telemetry: false,
  },

  vuetify: {
    // Keep Nuxt useLayout distinct from Vuetify useVLayout.
    moduleOptions: { prefixComposables: true },
    vuetifyOptions: {
      // Eager tooltip roots expose empty tooltip roles while their content is
      // hidden. Mount the overlay when opened and remove it after closing.
      defaults: { VTooltip: { eager: false } },
      theme: {
        defaultTheme: "light",
        themes: {
          light: {
            colors: THEME_COLORS,
            // Keep small labels and hints legible on filled and white fields.
            variables: { "medium-emphasis-opacity": 0.75 },
          },
        },
      },
    },
  },

  vite: {
    // Routes and client-only components hide some imports from the initial scan.
    // Bundle them up front so exploring pages or reporting a bug doesn't reload.
    optimizeDeps: {
      include: [
        "@geoman-io/maplibre-geoman-free",
        "@sentry/nuxt",
        "@turf/turf",
        "@vue/devtools-core",
        "@vueuse/core",
        "ajv/dist/2020",
        "file-saver",
        "jszip",
        "maplibre-gl",
        "markdown-it",
        "markdown-it-attrs",
        "markdown-it-div",
        "mathjs",
        "papaparse",
        "plotly.js/lib/core",
        "plotly.js/lib/scatter",
        "sanitize-html",
      ],
    },
    build: {
      cssMinify: "lightningcss",
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "~/assets/style/variables.scss" as *;',
        },
      },
    },
  },
});
