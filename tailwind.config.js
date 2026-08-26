/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./gemini/index.html",
    "./gemini/src/**/*.{js,ts,jsx,tsx}",
    "./claude/index.html",
    "./claude/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        itoen: {
          dark: '#0e3a1f',
          DEFAULT: '#1b6b37',
          green: '#2ea44f',
          light: '#65c466',
          tea: '#8dc63f',
          gold: '#e5a93c',
          goldLight: '#fde047',
          cream: '#f9f8f3'
        },
        stadium: {
          navy: '#0b132b',
          blue: '#1c2541',
          cyan: '#48bfe3',
          red: '#e63946',
          clay: '#c16643',
          chalk: '#f8f9fa'
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Zen Kaku Gothic New', 'Noto Sans JP', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Zen Kaku Gothic New', 'sans-serif']
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-10px) rotate(2deg)' }
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.8', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' }
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' }
        },
        pedestalSpin: {
          '0%': { transform: 'rotateX(60deg) rotateZ(0deg)' },
          '100%': { transform: 'rotateX(60deg) rotateZ(360deg)' }
        }
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
        pulseGlow: 'pulseGlow 2s ease-in-out infinite',
        shimmer: 'shimmer 2.5s infinite linear',
        pedestal: 'pedestalSpin 12s linear infinite'
      }
    },
  },
  plugins: [],
}
