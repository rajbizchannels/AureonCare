/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'aureon-gold': '#F4A460',
        'aureon-amber': '#FFB347',
        'aureon-blue': '#1E3A8A',
        'aureon-ocean': '#0C4A6E',
      },
      backgroundImage: {
        'gradient-aureon': 'linear-gradient(135deg, #FFB347 0%, #F4A460 25%, #0C4A6E 75%, #1E3A8A 100%)',
        'gradient-aureon-light': 'linear-gradient(135deg, rgba(255, 179, 71, 0.1) 0%, rgba(12, 74, 110, 0.1) 100%)',
      },
    },
  },
  plugins: [],
}
