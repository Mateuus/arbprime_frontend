import type { Config } from "tailwindcss";

export default {
  darkMode: 'class',
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
        arbcrypto: "#1f2937",
        brand: {
          sidebar: '#00181c',
          button: '#48fff3',
          dark: '#00191d',
          border: '#01322c',
          hover: '#02201b',
          active: '#024c3b',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;