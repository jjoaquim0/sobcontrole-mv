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
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
