export interface EditorFont {
  id: string;
  label: string;
  category: "serif" | "sans" | "accessible" | "mono";
  cssFamily: string;
}

export const EDITOR_FONTS: EditorFont[] = [
  // Serif
  {
    id: "literata",
    label: "Literata",
    category: "serif",
    cssFamily: "var(--font-literata), Georgia, serif",
  },
  {
    id: "lusitana",
    label: "Lusitana",
    category: "serif",
    cssFamily: "var(--font-lusitana), Georgia, serif",
  },
  {
    id: "lora",
    label: "Lora",
    category: "serif",
    cssFamily: "var(--font-lora), Georgia, serif",
  },
  {
    id: "merriweather",
    label: "Merriweather",
    category: "serif",
    cssFamily: "var(--font-merriweather), Georgia, serif",
  },
  {
    id: "eb-garamond",
    label: "EB Garamond",
    category: "serif",
    cssFamily: "var(--font-eb-garamond), Georgia, serif",
  },
  {
    id: "crimson-pro",
    label: "Crimson Pro",
    category: "serif",
    cssFamily: "var(--font-crimson-pro), Georgia, serif",
  },
  {
    id: "spectral",
    label: "Spectral",
    category: "serif",
    cssFamily: "var(--font-spectral), Georgia, serif",
  },
  // Sans-serif
  {
    id: "inter",
    label: "Inter",
    category: "sans",
    cssFamily: "var(--font-inter), system-ui, sans-serif",
  },
  {
    id: "source-sans",
    label: "Source Sans 3",
    category: "sans",
    cssFamily: "var(--font-source-sans), system-ui, sans-serif",
  },
  // Accessible / dyslexia-friendly
  {
    id: "lexend",
    label: "Lexend",
    category: "accessible",
    cssFamily: "var(--font-lexend), system-ui, sans-serif",
  },
  {
    id: "atkinson",
    label: "Atkinson Hyperlegible",
    category: "accessible",
    cssFamily: "var(--font-atkinson), system-ui, sans-serif",
  },
  {
    id: "open-dyslexic",
    label: "OpenDyslexic",
    category: "accessible",
    cssFamily: "'OpenDyslexic', Comic Sans MS, sans-serif",
  },
  {
    id: "comic-sans",
    label: "Comic Sans",
    category: "accessible",
    cssFamily: "'Comic Sans MS', 'Comic Sans', cursive",
  },
  // Monospace
  {
    id: "courier-prime",
    label: "Courier Prime",
    category: "mono",
    cssFamily: "var(--font-courier-prime), 'Courier New', monospace",
  },
  {
    id: "jetbrains-mono",
    label: "JetBrains Mono",
    category: "mono",
    cssFamily: "var(--font-jetbrains-mono), 'Courier New', monospace",
  },
];

export const DEFAULT_EDITOR_FONT = "literata";

export function getEditorFont(id: string): EditorFont {
  return (
    EDITOR_FONTS.find((f) => f.id === id) ??
    EDITOR_FONTS.find((f) => f.id === DEFAULT_EDITOR_FONT) ??
    EDITOR_FONTS[0]
  );
}
