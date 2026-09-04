import {
  EDITOR_WIDTH_OPTIONS,
  type EditorWidth,
  NEUTRAL_PALETTES,
  type NeutralColorName,
  PRIMARY_PALETTES,
  type PrimaryColorName,
  SHADE_KEYS,
  type ShadeMap,
  type UiDensity,
} from "./palettes";

// ─── Color palette (primary / neutral) ──────────────────────────────

function applyColorPalette(
  slot: "primary" | "neutral",
  name: string,
  palette: ShadeMap,
): void {
  const style = document.documentElement.style;
  const cache: Record<string, string> = {};

  for (const shade of SHADE_KEYS) {
    const prop = `--${slot}-${shade}`;
    const value = palette[shade];
    style.setProperty(prop, value);
    cache[prop] = value;
  }

  localStorage.setItem(`writr-${slot}-vars`, JSON.stringify(cache));
  localStorage.setItem(`writr-${slot}-color`, name);
}

export function applyPrimaryColor(name: PrimaryColorName): void {
  applyColorPalette("primary", name, PRIMARY_PALETTES[name]);
}

export function applyNeutralColor(name: NeutralColorName): void {
  applyColorPalette("neutral", name, NEUTRAL_PALETTES[name]);
}

// ─── Editor width ───────────────────────────────────────────────────

export function applyEditorWidth(width: EditorWidth): void {
  const opt = EDITOR_WIDTH_OPTIONS.find((o) => o.value === width);
  const css = opt?.css ?? "720px";
  document.documentElement.style.setProperty("--editor-content-width", css);
  localStorage.setItem("writr-editor-width", width);
}

// ─── UI density ─────────────────────────────────────────────────────

export function applyUiDensity(density: UiDensity): void {
  document.documentElement.setAttribute("data-density", density);
  localStorage.setItem("writr-density", density);
}

// ─── Hole highlight opacity ─────────────────────────────────────────

/** Set the background translucency of hole highlights (0–1). */
export function applyHoleHighlightOpacity(opacity: number): void {
  const clamped = Math.min(1, Math.max(0, opacity));
  document.documentElement.style.setProperty(
    "--hole-highlight-opacity",
    String(clamped),
  );
  localStorage.setItem("writr-hole-opacity", String(clamped));
}
