import colors from "vuetify/es5/util/colors";
import Vue from "vue";
import Vuetify from "vuetify/lib";

export default {
  primary: "#3D5A80",
  accent: "#EE6C4D",
  secondary: "#98C1D9",
  // primary: '#3D5A80',
  // accent: '#EE6C4D',
  // secondary: '#98C1D9',
  info: "#E0FBFC",
  warning: "#F9C80E",
  theme: {
    themes: {
      light: {
        primary: "#3D5A80",
        accent: "#EE6C4D",
        secondary: "#98C1D9",
        info: "#E0FBFC",
        warning: "#F9C80E",
      },
      dark: {
        primary: "#3D5A80",
        accent: "#EE6C4D",
        secondary: "#98C1D9",
        info: "#E0FBFC",
        warning: "#F9C80E",
      },
    },
  },
  breakpoint: {
    thresholds: {
      md: 1636, // 1620px (window width) + 16px (desktop scrollbar width)
    },
  },
};
