/**
 * Palette. Validated, not chosen by eye.
 *
 * These are the first three categorical slots of the reference data-viz palette, which clear every
 * hard gate on the all-pairs list in both modes:
 *   light — CVD ΔE 9.2, normal-vision ΔE 24.0
 *   dark  — CVD ΔE 9.4, normal-vision ΔE 20.9
 * (verified with the dataviz skill's validator; re-run it if you change a hex)
 *
 * One caveat carried over from that run: on the light surface `series-3` (aqua) measures 2.74:1,
 * below the 3:1 bar. The mitigation is the "relief rule" — every series carries a visible direct
 * label at the end of its curve, so identity never rests on colour alone. That is why
 * `drawSeriesLabel` is not optional decoration.
 */

export type Mode = "light" | "dark";

export interface Theme {
  mode: Mode;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  muted: string;
  grid: string;
  axis: string;
  series: readonly [string, string, string];
  good: string;
  warning: string;
  critical: string;
  font: string;
  mono: string;
}

const LIGHT: Theme = {
  mode: "light",
  surface: "#fcfcfb",
  textPrimary: "#0b0b0b",
  textSecondary: "#52514e",
  muted: "#898781",
  grid: "#e1e0d9",
  axis: "#c3c2b7",
  series: ["#2a78d6", "#eb6834", "#1baf7a"],
  good: "#0ca30c",
  warning: "#fab219",
  critical: "#d03b3b",
  font: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

const DARK: Theme = {
  ...LIGHT,
  mode: "dark",
  surface: "#1a1a19",
  textPrimary: "#ffffff",
  textSecondary: "#c3c2b7",
  muted: "#898781",
  grid: "#2c2c2a",
  axis: "#383835",
  // Same eight hues, stepped for the dark surface — not an automatic flip of the light values.
  series: ["#3987e5", "#d95926", "#199e70"],
};

export function getTheme(mode: Mode): Theme {
  return mode === "dark" ? DARK : LIGHT;
}

export function prefersDark(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia?.("(prefers-color-scheme: dark)").matches === true;
}

/** Maps a spec colour token to a hex value for the active mode. */
export function seriesColor(theme: Theme, token: string): string {
  switch (token) {
    case "series-1": return theme.series[0];
    case "series-2": return theme.series[1];
    case "series-3": return theme.series[2];
    default: return theme.series[0];
  }
}
