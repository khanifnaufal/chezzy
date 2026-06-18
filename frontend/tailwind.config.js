/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          50: '#faf8f5',
          100: '#f4ede1',
          200: '#eae2d3',
          300: '#dfd5be',
          400: '#cbd8d3',
          550: '#648579', // Added intermediate shades for perfect transitions
          500: '#8ea69d',
          600: '#4e7367',
          700: '#35554a',
          800: '#223c34',
          850: '#182c26',
          900: '#11231e',
          950: '#0a1412',
        },
        indigo: {
          50: '#fefcf6',
          100: '#fcf6e8',
          200: '#f7e6c4',
          300: '#f0d398',
          400: '#ead18c',
          500: '#f0c86e',
          600: '#dfb75c',
          700: '#cca04b',
          800: '#a88032',
          900: '#6c501f',
          950: '#38280f',
        },
        violet: {
          50: '#fffefb',
          100: '#fefaf0',
          200: '#fdf1d6',
          300: '#fbe2ad',
          400: '#f8cf7e',
          500: '#e2a532',
          600: '#c8891c',
          700: '#a26d11',
          800: '#7d5209',
          900: '#573703',
          950: '#301e01',
        }
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      }
    },
  },
  plugins: [],
}

