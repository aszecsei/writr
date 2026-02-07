import {
  EDITOR_WIDTH_OPTIONS,
  type EditorWidth,
  NEUTRAL_PALETTES,
  type NeutralColorName,
  PRIMARY_PALETTES,
  type PrimaryColorName,
  SHADE_KEYS,
  type UiDensity,
} from "./palettes";

// ─── Primary color ──────────────────────────────────────────────────

export function applyPrimaryColor(name: PrimaryColorName): void {
  const palette = PRIMARY_PALETTES[name];
  const style = document.documentElement.style;
  const cache: Record<string, string> = {};

  for (const shade of SHADE_KEYS) {
    const prop = `--primary-${shade}`;
    const value = palette[shade];
    style.setProperty(prop, value);
    cache[prop] = value;
  }

  localStorage.setItem("writr-primary-vars", JSON.stringify(cache));
  localStorage.setItem("writr-primary-color", name);
}

// ─── Neutral color ──────────────────────────────────────────────────

export function applyNeutralColor(name: NeutralColorName): void {
  const palette = NEUTRAL_PALETTES[name];
  const style = document.documentElement.style;
  const cache: Record<string, string> = {};

  for (const shade of SHADE_KEYS) {
    const prop = `--neutral-${shade}`;
    const value = palette[shade];
    style.setProperty(prop, value);
    cache[prop] = value;
  }

  localStorage.setItem("writr-neutral-vars", JSON.stringify(cache));
  localStorage.setItem("writr-neutral-color", name);
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
