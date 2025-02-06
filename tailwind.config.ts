import type {Config} from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        lexend: ["var(--font-lexend)", "sans-serif"],
        akshar: ["var(--font-akshar)", "sans-serif"],
        roboto: ["var(--font-roboto)", "sans-serif"],
        ibmMono: ["var(--font-ibm-mono)", "monospace"],
        chakra: ["var(--font-chakra)", "sans-serif"],
        inter: ["var(--font-inter)", "sans-serif"],
        alata: ["var(--font-alata)", "sans-serif"],
      },
    },
  },
  plugins: [require('daisyui')],
};
export default config;
