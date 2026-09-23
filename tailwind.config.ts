import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1d1d1f",
        paper: "#f5f5f7",
        accent: "#0071e3",
        muted: "#86868b",
      },
      // Every step sits ~2px above Tailwind's default so text reads comfortably.
      fontSize: {
        xs: ["0.875rem", { lineHeight: "1.25rem" }],
        sm: ["1rem", { lineHeight: "1.5rem" }],
        base: ["1.125rem", { lineHeight: "1.75rem" }],
        lg: ["1.25rem", { lineHeight: "1.875rem" }],
        xl: ["1.375rem", { lineHeight: "2rem" }],
        "2xl": ["1.625rem", { lineHeight: "2.125rem" }],
        "3xl": ["2rem", { lineHeight: "2.5rem" }],
        "5xl": ["3.25rem", { lineHeight: "1" }],
        "6xl": ["4rem", { lineHeight: "1" }],
      },
      borderRadius: {
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
