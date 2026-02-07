// Tailwind CSS v4 default palette hex values
// 10 primary (accent) palettes + 5 neutral (chrome) palettes

export const SHADE_KEYS = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
] as const;
export type Shade = (typeof SHADE_KEYS)[number];

export type ShadeMap = Record<Shade, string>;

// ─── Primary (accent) palettes ──────────────────────────────────────

export const PRIMARY_PALETTES = {
  blue: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6",
    600: "#2563eb",
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
    950: "#172554",
  },
  indigo: {
    50: "#eef2ff",
    100: "#e0e7ff",
    200: "#c7d2fe",
    300: "#a5b4fc",
    400: "#818cf8",
    500: "#6366f1",
    600: "#4f46e5",
    700: "#4338ca",
    800: "#3730a3",
    900: "#312e81",
    950: "#1e1b4b",
  },
  violet: {
    50: "#f5f3ff",
    100: "#ede9fe",
    200: "#ddd6fe",
    300: "#c4b5fd",
    400: "#a78bfa",
    500: "#8b5cf6",
    600: "#7c3aed",
    700: "#6d28d9",
    800: "#5b21b6",
    900: "#4c1d95",
    950: "#2e1065",
  },
  rose: {
    50: "#fff1f2",
    100: "#ffe4e6",
    200: "#fecdd3",
    300: "#fda4af",
    400: "#fb7185",
    500: "#f43f5e",
    600: "#e11d48",
    700: "#be123c",
    800: "#9f1239",
    900: "#881337",
    950: "#4c0519",
  },
  emerald: {
    50: "#ecfdf5",
    100: "#d1fae5",
    200: "#a7f3d0",
    300: "#6ee7b7",
    400: "#34d399",
    500: "#10b981",
    600: "#059669",
    700: "#047857",
    800: "#065f46",
    900: "#064e3b",
    950: "#022c22",
  },
  amber: {
    50: "#fffbeb",
    100: "#fef3c7",
    200: "#fde68a",
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
    700: "#b45309",
    800: "#92400e",
    900: "#78350f",
    950: "#451a03",
  },
  teal: {
    50: "#f0fdfa",
    100: "#ccfbf1",
    200: "#99f6e4",
    300: "#5eead4",
    400: "#2dd4bf",
    500: "#14b8a6",
    600: "#0d9488",
    700: "#0f766e",
    800: "#115e59",
    900: "#134e4a",
    950: "#042f2e",
  },
  orange: {
    50: "#fff7ed",
    100: "#ffedd5",
    200: "#fed7aa",
    300: "#fdba74",
    400: "#fb923c",
    500: "#f97316",
    600: "#ea580c",
    700: "#c2410c",
    800: "#9a3412",
    900: "#7c2d12",
    950: "#431407",
  },
  cyan: {
    50: "#ecfeff",
    100: "#cffafe",
    200: "#a5f3fc",
    300: "#67e8f9",
    400: "#22d3ee",
    500: "#06b6d4",
    600: "#0891b2",
    700: "#0e7490",
    800: "#155e75",
    900: "#164e63",
    950: "#083344",
  },
  pink: {
    50: "#fdf2f8",
    100: "#fce7f3",
    200: "#fbcfe8",
    300: "#f9a8d4",
    400: "#f472b6",
    500: "#ec4899",
    600: "#db2777",
    700: "#be185d",
    800: "#9d174d",
    900: "#831843",
    950: "#500724",
  },
} as const satisfies Record<string, ShadeMap>;

export type PrimaryColorName = keyof typeof PRIMARY_PALETTES;
export const PRIMARY_COLOR_NAMES = Object.keys(
  PRIMARY_PALETTES,
) as PrimaryColorName[];

// ─── Neutral (chrome) palettes ──────────────────────────────────────

export const NEUTRAL_PALETTES = {
  zinc: {
    50: "#fafafa",
    100: "#f4f4f5",
    200: "#e4e4e7",
    300: "#d4d4d8",
    400: "#a1a1aa",
    500: "#71717a",
    600: "#52525b",
    700: "#3f3f46",
    800: "#27272a",
    900: "#18181b",
    950: "#09090b",
  },
  slate: {
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
    950: "#020617",
  },
  gray: {
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    800: "#1f2937",
    900: "#111827",
    950: "#030712",
  },
  stone: {
    50: "#fafaf9",
    100: "#f5f5f4",
    200: "#e7e5e4",
    300: "#d6d3d1",
    400: "#a8a29e",
    500: "#78716c",
    600: "#57534e",
    700: "#44403c",
    800: "#292524",
    900: "#1c1917",
    950: "#0c0a09",
  },
  neutral: {
    50: "#fafafa",
    100: "#f5f5f5",
    200: "#e5e5e5",
    300: "#d4d4d4",
    400: "#a3a3a3",
    500: "#737373",
    600: "#525252",
    700: "#404040",
    800: "#262626",
    900: "#171717",
    950: "#0a0a0a",
  },
} as const satisfies Record<string, ShadeMap>;

export type NeutralColorName = keyof typeof NEUTRAL_PALETTES;
export const NEUTRAL_COLOR_NAMES = Object.keys(
  NEUTRAL_PALETTES,
) as NeutralColorName[];

// ─── UI option metadata (label + swatch color for settings UI) ──────

export const PRIMARY_OPTIONS: {
  name: PrimaryColorName;
  label: string;
  swatch: string;
}[] = [
  { name: "blue", label: "Blue", swatch: "#3b82f6" },
  { name: "indigo", label: "Indigo", swatch: "#6366f1" },
  { name: "violet", label: "Violet", swatch: "#8b5cf6" },
  { name: "rose", label: "Rose", swatch: "#f43f5e" },
  { name: "emerald", label: "Emerald", swatch: "#10b981" },
  { name: "amber", label: "Amber", swatch: "#f59e0b" },
  { name: "teal", label: "Teal", swatch: "#14b8a6" },
  { name: "orange", label: "Orange", swatch: "#f97316" },
  { name: "cyan", label: "Cyan", swatch: "#06b6d4" },
  { name: "pink", label: "Pink", swatch: "#ec4899" },
];

export const NEUTRAL_OPTIONS: {
  name: NeutralColorName;
  label: string;
  swatch: string;
}[] = [
  { name: "zinc", label: "Zinc", swatch: "#71717a" },
  { name: "slate", label: "Slate", swatch: "#64748b" },
  { name: "gray", label: "Gray", swatch: "#6b7280" },
  { name: "stone", label: "Stone", swatch: "#78716c" },
  { name: "neutral", label: "Neutral", swatch: "#737373" },
];

// ─── Editor width + density options ─────────────────────────────────

export type EditorWidth = "narrow" | "medium" | "wide";
export type UiDensity = "compact" | "comfortable";

export const EDITOR_WIDTH_OPTIONS: {
  value: EditorWidth;
  label: string;
  css: string;
}[] = [
  { value: "narrow", label: "Narrow", css: "720px" },
  { value: "medium", label: "Medium", css: "900px" },
  { value: "wide", label: "Wide", css: "1200px" },
];

export const UI_DENSITY_OPTIONS: { value: UiDensity; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
];
