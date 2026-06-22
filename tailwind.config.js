/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#FFF9E6',
          100: '#FFF0BF',
          200: '#FFE699',
          300: '#FFD966',
          400: '#FFCC33',
          500: '#D4A017',
          600: '#B8860B',
          700: '#996515',
          800: '#7A4F0F',
          900: '#5C3A0A',
        },
        navy: {
          50: '#E8EAF0',
          100: '#C5CAD6',
          200: '#9EA7BA',
          300: '#77849E',
          400: '#596A8A',
          500: '#3B5076',
          600: '#2D3F5E',
          700: '#1F2E47',
          800: '#141E30',
          900: '#0A0F18',
        },
        hotel: {
          cream: '#FAF5EF',
          marble: '#F5F0E8',
          charcoal: '#2C2C2C',
          burgundy: '#800020',
          emerald: '#046307',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
        display: ['Segoe UI', 'Tahoma', 'Geneva', 'sans-serif'],
      },
      boxShadow: {
        luxury: '0 4px 30px rgba(0, 0, 0, 0.12)',
        card: '0 2px 15px rgba(0, 0, 0, 0.08)',
        glow: '0 0 20px rgba(212, 160, 23, 0.3)',
      },
    },
  },
  plugins: [],
};
