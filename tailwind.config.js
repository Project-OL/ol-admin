/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        admin: {
          bg: '#0F1117',
          surface: '#1A1D27',
          border: '#2A2D3E',
          accent: '#7C5CFC',
          accentHover: '#6A4AE8',
          danger: '#E53E3E',
          warn: '#D97706',
          success: '#10B981',
          muted: '#6B7280',
          text: '#F1F5F9',
          subtext: '#94A3B8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
