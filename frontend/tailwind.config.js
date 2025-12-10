/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        'surface-ground': 'var(--surface-ground)',
        'surface-card': 'var(--surface-card)',
        'surface-overlay': 'var(--surface-overlay)',
        'surface-border': 'var(--surface-border)',
        'surface-hover': 'var(--surface-hover)',
        'text-color': 'var(--text-color)',
        'text-secondary': 'var(--text-color-secondary)',
        'primary': 'var(--primary-color)',
        'primary-text': 'var(--primary-color-text)',
      }
    },
  },
  darkMode: 'class',
  plugins: [],
}