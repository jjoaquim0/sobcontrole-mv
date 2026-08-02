/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#10b981',
          hover: '#059669',
        },
        themeBg: {
          light: '#f0f2f5',
          dark: '#0f1117',
        },
        themeCard: {
          light: '#ffffff',
          dark: '#1a1d27',
        },
        themeText: {
          primaryLight: '#111827',
          primaryDark: '#f9fafb',
          secondaryLight: '#6b7280',
          secondaryDark: '#9ca3af',
        },
        themeBorder: {
          light: '#e5e7eb',
          dark: 'rgba(255,255,255,0.06)',
        },
        themeSidebar: {
          light: '#f8fafc',
          dark: '#0a0b0e',
          dividerLight: 'rgba(11,37,81,0.06)',
          dividerDark: 'rgba(164,244,253,0.05)',
        },
        // Tokens semânticos do tema claro da landing page pública.
        // As variáveis são declaradas apenas em `.landing-theme` (src/index.css),
        // portanto estas utilidades não têm efeito dentro do app autenticado —
        // nem quando o usuário tem o tema escuro salvo (classe `.dark` no <html>).
        landing: {
          bg: 'rgb(var(--landing-background) / <alpha-value>)',
          surface: 'rgb(var(--landing-surface) / <alpha-value>)',
          'surface-muted': 'rgb(var(--landing-surface-muted) / <alpha-value>)',
          'surface-brand': 'rgb(var(--landing-surface-brand) / <alpha-value>)',
          text: 'rgb(var(--landing-text-primary) / <alpha-value>)',
          'text-secondary': 'rgb(var(--landing-text-secondary) / <alpha-value>)',
          'text-muted': 'rgb(var(--landing-text-muted) / <alpha-value>)',
          border: 'rgb(var(--landing-border) / <alpha-value>)',
          'border-strong': 'rgb(var(--landing-border-strong) / <alpha-value>)',
          brand: 'rgb(var(--landing-brand-primary) / <alpha-value>)',
          'brand-hover': 'rgb(var(--landing-brand-hover) / <alpha-value>)',
          accent: 'rgb(var(--landing-brand-accent) / <alpha-value>)',
          glow: 'rgb(var(--landing-brand-glow) / <alpha-value>)',
          success: 'rgb(var(--landing-success) / <alpha-value>)',
          warning: 'rgb(var(--landing-warning) / <alpha-value>)',
          danger: 'rgb(var(--landing-danger) / <alpha-value>)',
        },
      },
      boxShadow: {
        'landing-sm': 'var(--landing-shadow-sm)',
        landing: 'var(--landing-shadow)',
        'landing-lg': 'var(--landing-shadow-lg)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        // Tipografia da marca (manual de marca v1): o wordmark "sobcontrole" é
        // sempre Archivo 600. Inter fica como fallback enquanto a fonte carrega.
        brand: ['Archivo', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
