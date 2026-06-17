/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Construction palette
        ink: "#0c0a09",       // near-black (stone-950)
        steel: "#1c1917",     // stone-900
        concrete: "#fafaf9",  // stone-50
        rebar: "#78716c",     // stone-500
        hi: "#facc15",        // safety yellow (yellow-400)
        hi2: "#f59e0b",       // amber-500 for hover
        ok: "#16a34a",
        warn: "#b45309",
        err: "#dc2626"
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif"
        ]
      },
      backgroundImage: {
        // Caution-tape stripe used under the header
        "caution-tape":
          "repeating-linear-gradient(45deg, #facc15 0 14px, #0c0a09 14px 28px)"
      },
      boxShadow: {
        chunky: "0 4px 0 0 #0c0a09"
      }
    }
  },
  plugins: []
};
