import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ocean: {
          deep: "#0b1f3a",
          mid: "#15355c",
          surface: "#1f4f80",
          foam: "#cfe6ff",
        },
        sail: {
          canvas: "#f5efe0",
          shadow: "#bdb29a",
        },
      },
      fontFamily: {
        display: ["ui-sans-serif", "system-ui", "sans-serif"],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
