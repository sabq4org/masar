import type { Config } from "tailwindcss";

export default {
  content: ["./client/index.html", "./client/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "var(--masar-ink)", 2: "var(--masar-ink-2)", 3: "var(--masar-muted)" },
        paper: "var(--masar-paper)",
        surface: "var(--masar-surface)",
        line: { DEFAULT: "var(--masar-line)", soft: "var(--masar-line-soft)" },
        // الفعل الأساسي حبر؛ soft = خلفية «أنت هنا» الزعفرانية الخفيفة
        accent: {
          DEFAULT: "var(--masar-ink)",
          ink: "var(--masar-ink)",
          soft: "var(--masar-saffron-soft)",
        },
        saffron: "var(--masar-saffron)",
        success: "var(--masar-success)",
        wait: "var(--masar-wait)",
        review: "var(--masar-review)",
        danger: "var(--masar-danger)",
      },
      borderRadius: {
        chip: "999px",
        field: "9px",
        card: "16px",
        sheet: "20px",
      },
      boxShadow: {
        card: "var(--shadow-card)",
      },
      fontFamily: {
        sans: ["IBM Plex Sans Arabic", "-apple-system", "Segoe UI", "Tahoma", "sans-serif"],
        display: ["Alexandria", "IBM Plex Sans Arabic", "sans-serif"],
        latin: ["Space Grotesk", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
