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
          href: "https://fonts.googleapis.com/css?family=Material+Icons",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css?family=Roboto:300,400,500,700",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css?family=Bitter:400,700",
        },
        {
          rel: "stylesheet",
          href: "https://use.fontawesome.com/releases/v5.11.2/css/all.css",
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
      gtagId: process.env.NUXT_PUBLIC_GTAG_ID || "G-M0NVBT90BT",
      cartoApiKey: "",
      stadiaApiKey: "",
      stadiaDomainAuth: false,
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
    vuetifyOptions: {
      theme: {
        defaultTheme: "light",
        themes: {
          light: {
            colors: THEME_COLORS,
          },
        },
      },
    },
  },

  vite: {
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
