/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        coal: {
          900: '#f8fafc',
          800: '#ffffff',
          700: '#f1f5f9',
          600: '#e2e8f0'
        },
        steel: {
          100: '#0f172a',
          200: '#1e293b',
          300: '#334155',
          400: '#64748b',
          500: '#94a3b8',
          600: '#cbd5e1',
          700: '#e2e8f0'
        },
        signal: {
          400: '#15803d',
          500: '#16a34a',
          600: '#22c55e'
        },
        amber: {
          400: '#b45309',
          500: '#d97706'
        },
        warn: {
          500: '#dc2626'
        }
      },
      boxShadow: {
        panel: '0 14px 32px -22px rgba(15, 23, 42, 0.22)',
        glow: '0 0 20px rgba(22, 163, 74, 0.18)'
      }
    }
  },
  plugins: []
}
