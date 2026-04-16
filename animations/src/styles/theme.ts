// ── Color palette ───────────────────────────────────────────
export const colors = {
  bg: "#1a1a2e",
  boxFill: "#16213e",
  boxStroke: "#e2e8f0",
  green: "#4ade80",
  blue: "#60a5fa",
  red: "#f87171",
  gray: "#64748b",
  white: "#f1f5f9",
  faint: "#94a3b8",
  eventFill: "#1e3a5f",
} as const;

// ── Typography ──────────────────────────────────────────────
export const fonts = {
  body: "Inter, system-ui, sans-serif",
  mono: "JetBrains Mono, monospace",
} as const;

// ── Shared sizing ───────────────────────────────────────────
export const sizes = {
  boxW: 200,
  boxH: 100,
  gap: 260, // center-to-center horizontal distance
  blockH: 44,
  blockW: 160,
  radius: 16,
  blockRadius: 8,
  lineWidth: 2,
  arrowSize: 10,
} as const;

// ── Common text props ───────────────────────────────────────
export const textProps = {
  heading: {
    fontSize: 28,
    fontWeight: 600,
    fontFamily: fonts.body,
    fill: colors.white,
  },
  phase: {
    fontSize: 36,
    fontWeight: 700,
    fontFamily: fonts.body,
    fill: colors.white,
  },
  label: {
    fontSize: 20,
    fontWeight: 500,
    fontFamily: fonts.body,
    fill: colors.faint,
  },
  mono: {
    fontSize: 18,
    fontWeight: 500,
    fontFamily: fonts.mono,
    fill: colors.white,
  },
  monoSmall: {
    fontSize: 16,
    fontWeight: 600,
    fontFamily: fonts.mono,
  },
  bigLabel: {
    fontSize: 32,
    fontWeight: 800,
    fontFamily: fonts.body,
  },
} as const;

// ── Common box props ────────────────────────────────────────
export const boxProps = {
  main: {
    width: sizes.boxW,
    height: sizes.boxH,
    radius: sizes.radius,
    fill: colors.boxFill,
    stroke: colors.boxStroke,
    lineWidth: sizes.lineWidth,
  },
  event: {
    width: sizes.blockW,
    height: sizes.blockH,
    radius: sizes.blockRadius,
    fill: colors.eventFill,
    lineWidth: sizes.lineWidth,
  },
  packet: {
    width: 100,
    height: 36,
    radius: sizes.blockRadius,
  },
} as const;
