/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        midnight: "#12162A",
        dusk: "#1D2340",
        duskLight: "#272E52",
        gold: "#E8A33D",
        goldSoft: "#F3C77A",
        mist: "#C9CEDD",
        mistDim: "#8891AC",
        paper: "#F8F4EA",
        paperDim: "#EDE6D6",
        ink: "#2A2517",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      boxShadow: {
        paper: "0 12px 30px -12px rgba(0,0,0,0.45)",
      },
      keyframes: {
        riseIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        sparkPulse: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        riseIn: "riseIn 0.45s ease-out both",
        sparkPulse: "sparkPulse 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
