import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design system palette — green primary / slate neutral / violet accent.
        // Token names kept (primary/brown/amber) so existing utility classes
        // recolor globally from here; `brown` = neutral scale, `amber` = accent.
        primary: {
          DEFAULT: "#38961c", // primary green
          50: "#f0f9e8",
          100: "#dcefc8",
          200: "#bfe29b",
          300: "#98cf66",
          400: "#6fb83a", // secondary (lighter green)
          500: "#4ea320",
          600: "#38961c",
          700: "#2d7817",
          800: "#245e13",
          900: "#1d4b10",
        },
        // Neutral scale (slate). Hits the spec at: 200 = border #E2E8F0,
        // 500 = muted #64748B, 900 = text #0F172A.
        brown: {
          DEFAULT: "#0F172A",
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
        // Accent scale (violet) — distinct from the original green/amber.
        amber: {
          DEFAULT: "#7C3AED", // accent violet (violet-600)
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7C3AED",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
        },
        canvas: "#F8FAFC", // app background (off-white; cards stay white)
        // Semantic status colors (independent of brand). Used by badges,
        // toasts, and alerts. `warning` = real amber (the `amber` token above
        // is now the violet accent), so warnings must use this instead.
        success: { DEFAULT: "#059669", 50: "#ecfdf5", 100: "#d1fae5", 500: "#10b981", 600: "#059669", 700: "#047857" },
        warning: { DEFAULT: "#d97706", 50: "#fffbeb", 100: "#fef3c7", 500: "#f59e0b", 600: "#d97706", 700: "#b45309" },
        danger: { DEFAULT: "#dc2626", 50: "#fef2f2", 100: "#fee2e2", 500: "#ef4444", 600: "#dc2626", 700: "#b91c1c" },
        info: { DEFAULT: "#0284c7", 50: "#f0f9ff", 100: "#e0f2fe", 500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        // Slightly rounder card language than the original (0.75rem) — a subtle,
        // pervasive shift that reshapes every rounded-xl surface at once.
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        // Softer, slate-tinted, layered card shadow (distinct from the old flat
        // neutral-black shadow). Propagates to every shadow-card surface.
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 2px 6px -1px rgb(15 23 42 / 0.06)",
        "card-hover": "0 4px 16px -2px rgb(15 23 42 / 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
