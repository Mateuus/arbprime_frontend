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
          input: {
            focus: '#22c55e', // green-500 puro
          },
          sidebar: '#00181c',
          button: '#48fff3',
          dark: '#00191d',
          border: '#01322c',
          hover: '#02201b',
          active: '#024c3b',
        },
      },
      keyframes: {
        'slide-in': {
          '0%': {
            transform: 'translateX(-40px)',
            opacity: '0',
          },
          '100%': {
            transform: 'translateX(0)',
            opacity: '1',
          },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.35s ease-in-out forwards',
      },
    },
  },
  plugins: [],
} satisfies Config;