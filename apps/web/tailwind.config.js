/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        farm: {
          green: '#1a6b3a',
          light: '#e8f5e9',
        },
      },
    },
  },
  plugins: [],
}
