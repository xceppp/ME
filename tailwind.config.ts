import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-2": "var(--bg-2)",
        card: "var(--card)",
        line: "var(--line)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        positive: "var(--positive)",
        attention: "var(--attention)",
        danger: "var(--danger)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 12px 40px rgba(0, 0, 0, 0.28)",
      },
      transitionDuration: {
        calm: "200ms",
      },
    },
  },
  plugins: [],
};

export default config;
