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
          // Dashboard admin (tokens teal/dark — ver .dashboard em globals.css).
          // Canal-triplo => o modifier /opacity (ex.: bg-brand-solid/20) funciona.
          solid: 'rgb(var(--ds-brand-400) / <alpha-value>)',
          500: 'rgb(var(--ds-brand-500) / <alpha-value>)',
        },
        // ── Tokens do Dashboard admin (só têm efeito dentro de .dashboard) ──
        surface: 'rgb(var(--ds-surface) / <alpha-value>)',
        surface2: 'rgb(var(--ds-surface-2) / <alpha-value>)',
        line: 'rgb(var(--ds-line) / <alpha-value>)',
        'line-strong': 'rgb(var(--ds-line-strong) / <alpha-value>)',
        fg: {
          DEFAULT: 'rgb(var(--ds-fg) / <alpha-value>)',
          muted: 'rgb(var(--ds-fg-muted) / <alpha-value>)',
          faint: 'rgb(var(--ds-fg-faint) / <alpha-value>)',
        },
        danger: {
          solid: 'rgb(var(--ds-danger-500) / <alpha-value>)',
          400: 'rgb(var(--ds-danger-400) / <alpha-value>)',
          500: 'rgb(var(--ds-danger-500) / <alpha-value>)',
        },
        success: {
          solid: 'rgb(var(--ds-success-500) / <alpha-value>)',
          400: 'rgb(var(--ds-success-400) / <alpha-value>)',
          500: 'rgb(var(--ds-success-500) / <alpha-value>)',
        },
        warning: {
          solid: 'rgb(var(--ds-warning-500) / <alpha-value>)',
          400: 'rgb(var(--ds-warning-400) / <alpha-value>)',
          500: 'rgb(var(--ds-warning-500) / <alpha-value>)',
        },
        info: {
          solid: 'rgb(var(--ds-info-500) / <alpha-value>)',
          400: 'rgb(var(--ds-info-400) / <alpha-value>)',
          500: 'rgb(var(--ds-info-500) / <alpha-value>)',
        },
      },
      maxWidth: {
        content: 'var(--ds-content-max)',
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