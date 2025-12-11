/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0B6EFF',
          50: '#E6F1FF',
          100: '#CCE3FF',
          200: '#99C7FF',
          300: '#66ABFF',
          400: '#338FFF',
          500: '#0B6EFF',
          600: '#0058CC',
          700: '#004299',
          800: '#002C66',
          900: '#001633',
        },
        accent: {
          DEFAULT: '#FF7A00',
          50: '#FFE8CC',
          100: '#FFD9B3',
          200: '#FFBB80',
          300: '#FF9D4D',
          400: '#FF8B26',
          500: '#FF7A00',
          600: '#CC6200',
          700: '#994900',
          800: '#663100',
          900: '#331800',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
