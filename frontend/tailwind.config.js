/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Logo-based Color Palette - Exact Logo Colors
        'logo-teal': {
          DEFAULT: '#1AB5AC', // Start of teal gradient
          start: '#1AB5AC',
          end: '#3AC8C4',
          50: '#e6f7f6',
          100: '#b3ebe8',
          200: '#80dfda',
          300: '#4dd3cc',
          400: '#1AB5AC', // Primary teal
          500: '#2AC0B8',
          600: '#3AC8C4', // End of teal gradient
          700: '#0B4F5E', // Dark teal for hover
          800: '#0a454f',
          900: '#083a42',
          950: '#062e35',
        },
        'logo-navy': {
          DEFAULT: '#162D4E', // Start of navy gradient
          start: '#162D4E',
          end: '#223A64',
          50: '#e8ecf2',
          100: '#c5d0df',
          200: '#a2b4cc',
          300: '#7f98b9',
          400: '#5c7ca6',
          500: '#162D4E', // Primary navy
          600: '#1a3560',
          700: '#223A64', // End of navy gradient
          800: '#1a2d4d',
          900: '#132036',
          950: '#0d1524',
        },
        'logo-dark-teal': {
          DEFAULT: '#0B4F5E',
          50: '#e6f2f4',
          100: '#b3d9de',
          200: '#80c0c8',
          300: '#4da7b2',
          400: '#1a8e9c',
          500: '#0B4F5E', // Dark teal accent
          600: '#09424e',
          700: '#07353e',
          800: '#05282e',
          900: '#031b1e',
          950: '#020e10',
        },
        'logo-green': {
          DEFAULT: '#006160', // Start of green gradient
          start: '#006160',
          end: '#0C7A76',
          50: '#e6f2f2',
          100: '#b3d9d9',
          200: '#80c0c0',
          300: '#4da7a7',
          400: '#1a8e8e',
          500: '#006160', // Primary green
          600: '#007a78',
          700: '#0C7A76', // End of green gradient
          800: '#0a6260',
          900: '#084a4a',
          950: '#053232',
        },
        'logo-border': {
          light: '#F4F4F4',
          dark: '#E0E0E0',
        },
        // Professional Color Palette - Mapped to Logo Colors
        primary: {
          DEFAULT: '#1AB5AC',
          50: '#e6f7f6',
          100: '#b3ebe8',
          200: '#80dfda',
          300: '#4dd3cc',
          400: '#1AB5AC', // Logo teal start
          500: '#2AC0B8',
          600: '#3AC8C4', // Logo teal end
          700: '#0B4F5E', // Dark teal for hover
          800: '#0a454f',
          900: '#083a42',
          950: '#062e35',
        },
        accent: {
          DEFAULT: '#162D4E',
          50: '#e8ecf2',
          100: '#c5d0df',
          200: '#a2b4cc',
          300: '#7f98b9',
          400: '#5c7ca6',
          500: '#162D4E', // Logo navy start
          600: '#1a3560',
          700: '#223A64', // Logo navy end
          800: '#1a2d4d',
          900: '#132036',
          950: '#0d1524',
        },
        gray: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        }
      },
      fontFamily: {
        sans: ['Lato', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif'],
        display: ['Lato', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif'],
        lato: ['Lato', 'sans-serif'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
        '7xl': ['4.5rem', { lineHeight: '1' }],
        '8xl': ['6rem', { lineHeight: '1' }],
        '9xl': ['8rem', { lineHeight: '1' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'medium': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'large': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        'none': 'none',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'slide-down': 'slideDown 0.6s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'bounce-gentle': 'bounceGentle 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-primary': 'linear-gradient(135deg, #1AB5AC 0%, #3AC8C4 100%)',
        'gradient-teal': 'linear-gradient(135deg, #1AB5AC 0%, #3AC8C4 100%)',
        'gradient-navy': 'linear-gradient(135deg, #162D4E 0%, #223A64 100%)',
        'gradient-green': 'linear-gradient(135deg, #006160 0%, #0C7A76 100%)',
        'gradient-blue': 'linear-gradient(135deg, #162D4E 0%, #223A64 100%)',
        'gradient-purple': 'linear-gradient(135deg, #1AB5AC 0%, #3AC8C4 100%)',
      },
      backdropBlur: {
        xs: '2px',
      },
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
}