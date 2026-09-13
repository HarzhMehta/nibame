/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#fafaf9', // warm calm stone-50
        surface: '#ffffff',
        muted: '#f5f5f4', // stone-100
        'muted-foreground': '#78716c', // stone-500
        border: '#e7e5e4', // stone-200
        foreground: '#1c1917', // stone-900
        primary: {
          DEFAULT: '#2563eb', // calm blue-600
          foreground: '#ffffff',
          hover: '#1d4ed8',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
