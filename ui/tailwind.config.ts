import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          base: "rgb(var(--bg-base) / <alpha-value>)",
          soft: "rgb(var(--bg-soft) / <alpha-value>)",
          mid: "rgb(var(--bg-mid) / <alpha-value>)",
        },
        fg: {
          base: "rgb(var(--fg-base) / <alpha-value>)",
          muted: "rgb(var(--fg-muted) / <alpha-value>)",
        },
        border: "rgb(var(--border) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        warn: {
          bg: "rgb(var(--warn-bg) / <alpha-value>)",
          fg: "rgb(var(--warn-fg) / <alpha-value>)",
          border: "rgb(var(--warn-border) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      maxWidth: {
        thread: "44rem",
      },
    },
  },
} satisfies Config;
