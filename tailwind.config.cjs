/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        coal: {
          900: '#0b0d10',
          800: '#11161b',
          700: '#161d24',
          600: '#1e2630'
        },
        steel: {
          100: '#e6edf3',
          200: '#c7d2da',
          300: '#a4b0bb',
          400: '#7f8c99',
          500: '#5f6e7c',
          600: '#455463',
          700: '#2b3845'
        },
        signal: {
          400: '#7bff9f',
          500: '#44f07f',
          600: '#1fbf60'
        },
        amber: {
          400: '#ffb95e',
          500: '#f39c3d'
        },
        warn: {
          500: '#ff5d5d'
        }
      },
      boxShadow: {
        panel: '0 12px 40px -24px rgba(0, 0, 0, 0.8)',
        glow: '0 0 18px rgba(68, 240, 127, 0.2)'
      }
    }
  },
  plugins: []
}
