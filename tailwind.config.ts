import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1.25rem", screens: { "2xl": "1280px" } },
    extend: {
      colors: {
        forest: { DEFAULT: "#245C45", foreground: "#FFFFFF", 50: "#EEF5F1", 100: "#DCE8D8", 600: "#245C45", 700: "#1D4B38", 800: "#173F32" },
        deep: "#173F32",
        cream: "#FAF8F2",
        sage: { DEFAULT: "#DCE8D8", light: "#EEF5EC" },
        coral: { DEFAULT: "#E98770", ink: "#9C4A36", soft: "#FCE9E3" },
        ink: "#1E2A25",
        muted: { DEFAULT: "#5C6B64", foreground: "#5C6B64" },
        line: "#E3E8E1",
        background: "#FAF8F2",
        foreground: "#1E2A25",
        card: { DEFAULT: "#FFFFFF", foreground: "#1E2A25" },
        primary: { DEFAULT: "#245C45", foreground: "#FFFFFF" },
        secondary: { DEFAULT: "#DCE8D8", foreground: "#173F32" },
        border: "#E3E8E1",
        input: "#CBD5CC",
        ring: "#245C45",
        destructive: { DEFAULT: "#B42318", foreground: "#FFFFFF" },
      },
      fontFamily: {
        sans: ["Inter Variable", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Manrope Variable", "Manrope", "Inter Variable", "system-ui", "sans-serif"],
      },
      borderRadius: { xl: "1rem", "2xl": "1.25rem", "3xl": "1.75rem" },
      boxShadow: {
        card: "0 1px 2px rgba(23,63,50,0.05), 0 4px 16px rgba(23,63,50,0.05)",
        lift: "0 8px 30px rgba(23,63,50,0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
