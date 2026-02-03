import type { CardTemplate } from "./types";

export interface TemplateStyle {
  name: string;
  background: string;
  textColor: string;
  accentColor: string;
  borderStyle?: string;
  textBackground?: string;
}

export const TEMPLATES: Record<CardTemplate, TemplateStyle> = {
  minimal: {
    name: "Minimal",
    background: "#ffffff",
    textColor: "#1a1a1a",
    accentColor: "#666666",
  },
  dramatic: {
    name: "Dramatic",
    background: "#0a0a0a",
    textColor: "#f5f5f5",
    accentColor: "#888888",
  },
  vintage: {
    name: "Vintage",
    background: "#f4f1e8",
    textColor: "#3d3d3d",
    accentColor: "#8b7355",
    borderStyle: "4px double #8b7355",
  },
  christmas: {
    name: "Christmas",
    background: "linear-gradient(135deg, #165B33 0%, #0B3D25 100%)",
    textColor: "#F8F6F0",
    accentColor: "#BB2528",
  },
  valentine: {
    name: "Valentine",
    background: "linear-gradient(135deg, #E8B4BC 0%, #D4919A 100%)",
    textColor: "#FFFFFF",
    accentColor: "#8B2942",
  },
  halloween: {
    name: "Halloween",
    background: "linear-gradient(180deg, #FF6A00 0%, #1A1A1A 100%)",
    textColor: "#FFFFFF",
    accentColor: "#FF6A00",
  },
  asexual: {
    name: "Asexual",
    background:
      "linear-gradient(135deg, #000000 25%, #A4A4A4 25%, #A4A4A4 50%, #FFFFFF 50%, #FFFFFF 75%, #810081 75%)",
    textColor: "#FFFFFF",
    accentColor: "#810081",
    textBackground: "rgba(0, 0, 0, 0.6)",
  },
  trans: {
    name: "Trans",
    background:
      "linear-gradient(135deg, #5BCEFA 20%, #F5A9B8 20%, #F5A9B8 40%, #FFFFFF 40%, #FFFFFF 60%, #F5A9B8 60%, #F5A9B8 80%, #5BCEFA 80%)",
    textColor: "#1A1A1A",
    accentColor: "#5BCEFA",
    textBackground: "rgba(255, 255, 255, 0.5)",
  },
  rainbow: {
    name: "Rainbow",
    background:
      "linear-gradient(135deg, #E40303 16.6%, #FF8C00 16.6%, #FF8C00 33.2%, #FFED00 33.2%, #FFED00 49.8%, #008026 49.8%, #008026 66.4%, #24408E 66.4%, #24408E 83%, #732982 83%)",
    textColor: "#FFFFFF",
    accentColor: "#FFFFFF",
    textBackground: "rgba(0, 0, 0, 0.5)",
  },
};

export const ASPECT_RATIOS = {
  square: { width: 1080, height: 1080, label: "Square (1:1)" },
  landscape: { width: 1200, height: 675, label: "Landscape (16:9)" },
  portrait: { width: 1080, height: 1350, label: "Portrait (4:5)" },
} as const;
