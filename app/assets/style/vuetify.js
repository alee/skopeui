import colors from "vuetify/es5/util/colors";
import Vue from "vue";
import Vuetify from "vuetify/lib";

export default {
  primary: "#3D5A80",
  accent: "#EE6C4D",
  secondary: "#6DB1BF",
  success: "#008148",
  error: "#CC0000",
  info: "#E0FBFC",
  warning: "#FFD275",
  theme: {
    themes: {
      light: {
        primary: "#3D5A80",
        accent: "#EE6C4D",
        secondary: "#6DB1BF",
        success: "#008148",
        error: "#CC0000",
        info: "#E0FBFC",
        warning: "#FFD275",
      },
      dark: {
        primary: "#3D5A80",
        accent: "#EE6C4D",
        secondary: "#6DB1BF",
        success: "#008148",
        error: "#CC0000",
        info: "#E0FBFC",
        warning: "#FFD275",
      },
    },
  },
  breakpoint: {
    thresholds: {
      md: 1636, // 1620px (window width) + 16px (desktop scrollbar width)
    },
  },
};
