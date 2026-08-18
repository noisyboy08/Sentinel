/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#000000',
        panel: '#09090B',
        'panel-2': '#121215',
        hairline: '#1F1F23',
        text: '#F4F4F5',
        muted: '#71717A',
        nominal: '#2DD4BF',
        caution: '#F59E0B',
        critical: '#EF4444',
        accent: '#A855F7',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
