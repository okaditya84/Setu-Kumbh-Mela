import type { Config } from "tailwindcss";

// Brand: Kumbh saffron + calm teal. High-contrast, large touch targets.
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        saffron: {
          50: "#fff7ed", 100: "#ffedd5", 200: "#fed7aa", 300: "#fdba74",
          400: "#fb923c", 500: "#f97316", 600: "#ea580c", 700: "#c2410c",
          800: "#9a3412", 900: "#7c2d12",
        },
        teal: {
          50: "#f0fdfa", 100: "#ccfbf1", 200: "#99f6e4", 300: "#5eead4",
          400: "#2dd4bf", 500: "#14b8a6", 600: "#0d9488", 700: "#0f766e",
          800: "#115e59", 900: "#134e4a",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        pulsering: {
          "0%": { transform: "scale(0.95)", opacity: "0.7" },
          "70%": { transform: "scale(1.3)", opacity: "0" },
          "100%": { transform: "scale(1.3)", opacity: "0" },
        },
      },
      animation: { pulsering: "pulsering 1.6s ease-out infinite" },
    },
  },
  plugins: [],
};
export default config;
