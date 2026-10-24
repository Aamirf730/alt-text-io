/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Legacy "teal" scale used by older pages: light steps are yellow,
        // dark steps are ink. No black.
        teal: {
          50: "#FFFBEA",
          100: "#FFF3B0",
          200: "#FFF3B0",
          300: "#FEE11C",
          400: "#FEE11C",
          500: "#FEE11C",
          600: "#3F3F46",
          700: "#3F3F46",
          800: "#3F3F46",
          900: "#3F3F46",
          950: "#3F3F46",
        },
        // Design-system tokens (docs/design-system.md)
        "brand-yellow": {
          DEFAULT: "hsl(var(--yellow) / <alpha-value>)",
          strong: "hsl(var(--yellow-strong) / <alpha-value>)",
          soft: "hsl(var(--yellow-soft) / <alpha-value>)",
          tint: "hsl(var(--yellow-tint) / <alpha-value>)",
        },
        "yellow-strong": "hsl(var(--yellow-strong) / <alpha-value>)",
        "yellow-soft": "hsl(var(--yellow-soft) / <alpha-value>)",
        "yellow-tint": "hsl(var(--yellow-tint) / <alpha-value>)",
        ink: {
          DEFAULT: "hsl(var(--ink) / <alpha-value>)",
          muted: "hsl(var(--ink-muted) / <alpha-value>)",
        },
        line: {
          DEFAULT: "hsl(var(--line) / <alpha-value>)",
          strong: "hsl(var(--line-strong) / <alpha-value>)",
        },
        success: "hsl(var(--success) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        error: "hsl(var(--error) / <alpha-value>)",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Legacy class names kept working, mapped onto the new tokens.
        notebook: {
          paper: "hsl(var(--paper-bg) / <alpha-value>)",
          surface: "hsl(var(--pearl-surface) / <alpha-value>)",
          blue: "hsl(var(--ink) / <alpha-value>)",
          yellow: "hsl(var(--yellow) / <alpha-value>)",
          teal: "hsl(var(--yellow) / <alpha-value>)",
          slate: "hsl(var(--ink) / <alpha-value>)",
          cloud: "hsl(var(--yellow-tint) / <alpha-value>)",
          black: "hsl(var(--ink) / <alpha-value>)",
          pearl: "hsl(var(--pearl-surface) / <alpha-value>)",
          orange: "hsl(var(--yellow) / <alpha-value>)",
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'notebook': 'var(--shadow-notebook)',
        'notebook-lg': 'var(--shadow-notebook-lg)',
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        lato: ["var(--font-lato)", "sans-serif"],
        outfit: ["Outfit", "sans-serif"],
      },
    },
  },
  plugins: [],
};
