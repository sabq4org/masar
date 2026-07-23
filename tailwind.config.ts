import type { Config } from "tailwindcss";

export default {
  content: ["./client/index.html", "./client/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#1c2733", 2: "#4a5866", 3: "#7b8794" },
        paper: "#f6f7f8",
        line: { DEFAULT: "#e3e7ea", soft: "#eef1f3" },
        accent: { DEFAULT: "#1f6fb2", soft: "#e8f1f9", ink: "#155181" },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "SF Arabic",
          "Segoe UI",
          "Noto Sans Arabic",
          "Tahoma",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
