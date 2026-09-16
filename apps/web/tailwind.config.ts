import type { Config } from "tailwindcss";

/**
 * FRONTEND: the canvas palette is NOT here — it lives in `lab-renderers/draw/theme.ts`, because the
 * renderer resolves colours itself and must stay React-free. Keep the two visually consistent by
 * reading the same token names; don't fork the values.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      // TODO(FRONTEND): mirror the lab-renderers token names (accent, ok, warn, muted, series-N)
    },
  },
  plugins: [],
};

export default config;
