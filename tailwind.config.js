/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'title': ['Playfair Display', 'serif'],
        'body': ['Inter', 'sans-serif'],
      },
      colors: {
        'gold': {
          DEFAULT: '#D4AF37',
          50: '#F8F4E6',
          100: '#F0E6B8',
          200: '#E8D889',
          300: '#E0CA5A',
          400: '#D8BC2B',
          500: '#D4AF37',
          600: '#B8941F',
          700: '#9C7919',
          800: '#805E13',
          900: '#64430D',
        },
        'wood': {
          'light': '#F5E6D3',
          'medium': '#8B4513',
          'dark': '#654321',
        },
        'cream': {
          DEFAULT: '#FDF6E3',
          'light': '#FEFBF0',
          50: '#FEFBF0',
          100: '#FDF6E3',
          200: '#FBF0D6',
          300: '#F9EBC9',
          400: '#F7E5BC',
          500: '#F5DFAF',
        },
      },
      boxShadow: {
        'luxury': '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'luxury-lg': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'luxury-xl': '0 35px 60px -12px rgba(0, 0, 0, 0.3)',
        'glow': '0 0 20px rgba(212, 175, 55, 0.3)',
        'glow-strong': '0 0 30px rgba(212, 175, 55, 0.5)',
      },
    },
  },
  plugins: [],
};