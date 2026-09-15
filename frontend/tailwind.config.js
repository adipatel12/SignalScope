/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        surface: '#121212',
        surfaceHover: '#1e1e1e',
        brand: {
          green: '#00ff41',
          cyan: '#00e5ff',
        },
        alert: {
          red: '#ff003c',
          amber: '#ffaa00',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
        mono: ['Fira Code', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      animation: {
        'scan': 'scan 2s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' }
        }
      }
    },
  },
  plugins: [],
}
