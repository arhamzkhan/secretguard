/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: "#0a0a0c",
        cardBg: "#121318",
        borderSubtle: "#222530",
        brandAccent: "#6366f1"
      }
    },
  },
  plugins: [],
}
