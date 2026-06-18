/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Resscott — charcoal + renewable leaf-green
        ink: "#1c1917",        // charcoal (logo wordmark)
        steel: "#292524",      // darker charcoal (hover)
        concrete: "#fafaf9",   // off-white background
        rebar: "#78716c",      // muted gray text
        hi: "#5aa72e",         // leaf green (accent / CTA)
        hi2: "#47861f",        // darker green (hover / white-on-green)
        "leaf-tint": "#eef6e8",// pale green wash
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
        // Thin charcoal → green accent rule under the header
        "brand-rule": "linear-gradient(90deg, #1c1917 0%, #5aa72e 60%, #7fc24a 100%)"
      },
      boxShadow: {
        soft: "0 1px 2px rgba(28,25,23,0.06), 0 6px 16px rgba(28,25,23,0.08)"
      }
    }
  },
  plugins: []
};
