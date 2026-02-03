import type { CardTemplate } from "./types";

export interface TemplateStyle {
  name: string;
  background: string;
  textColor: string;
  accentColor: string;
  fontFamily: string;
  borderStyle?: string;
}

export const TEMPLATES: Record<CardTemplate, TemplateStyle> = {
  minimal: {
    name: "Minimal",
    background: "#ffffff",
    textColor: "#1a1a1a",
    accentColor: "#666666",
    fontFamily: "'Georgia', serif",
  },
  dramatic: {
    name: "Dramatic",
    background: "#0a0a0a",
    textColor: "#f5f5f5",
    accentColor: "#888888",
    fontFamily: "'Georgia', serif",
  },
  vintage: {
    name: "Vintage",
    background: "#f4f1e8",
    textColor: "#3d3d3d",
    accentColor: "#8b7355",
    fontFamily: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
    borderStyle: "4px double #8b7355",
  },
};

export const ASPECT_RATIOS = {
  square: { width: 1080, height: 1080, label: "Square (1:1)" },
  landscape: { width: 1200, height: 675, label: "Landscape (16:9)" },
  portrait: { width: 1080, height: 1350, label: "Portrait (4:5)" },
} as const;
