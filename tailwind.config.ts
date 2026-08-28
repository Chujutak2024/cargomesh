import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/webmcp/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F3F1E9",
        "paper-raised": "#FFFFFF",
        ink: "#1A1812",
        "text-secondary": "#5B5748",
        "text-muted": "#928D79",
        line: "#E4E0D2",
        brass: {
          DEFAULT: "#8C6316",
          mid: "#A9791F",
          bright: "#C4901F",
          soft: "#F1E1BB",
        },
        green: {
          DEFAULT: "#3F6B4A",
          bg: "#E1EADD",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        heading: ["var(--font-overpass)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        lg: "20px",
        md: "14px",
        pill: "999px",
      },
    },
  },
  plugins: [],
};
export default config;
