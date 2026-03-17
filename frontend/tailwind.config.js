/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        "surface-ground": "var(--surface-ground)",
        "surface-card": "var(--surface-card)",
        "surface-overlay": "var(--surface-overlay)",
        "surface-border": "var(--surface-border)",
        "surface-hover": "var(--surface-hover)",
        color: "var(--text-color)",
        secondary: "var(--text-color-secondary)",
        emphasis: "var(--text-color-emphasis, var(--text-color))",
        primary: "var(--primary-color)",
        "primary-text": "var(--primary-color-text)",
        accent: "var(--accent-color, var(--primary-color))",
        "accent-bg": "var(--accent-bg, rgba(0,0,0,0.05))",
        "accent-secondary": "var(--accent-secondary, var(--primary-color))",
        "nav-active": "var(--nav-active-bg, rgba(0,0,0,0.05))",
        "nav-active-text": "var(--nav-active-text, var(--primary-color))",
        "nav-hover": "var(--nav-hover-bg, var(--surface-hover))",
        "avatar-bg": "var(--avatar-bg, rgba(0,0,0,0.1))",
        "avatar-text": "var(--avatar-text, var(--primary-color))",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        serif: ['"Playfair Display"', "serif"],
      },
      borderRadius: {
        organic: "1.5rem" /* 24px */,
        pill: "9999px",
        "xl-organic": "2rem" /* 32px */,
      },
      boxShadow: {
        elegant: "0 10px 40px -10px rgba(0, 0, 0, 0.08)",
        "elegant-dark": "0 10px 40px -10px rgba(0, 0, 0, 0.4)",
        card: "var(--shadow-card)",
      },
    },
  },
  darkMode: "class",
  plugins: [require("@tailwindcss/typography")],
};
