import type { z } from "zod";
import type { ToolResult } from "../types";

export function ok(
  message: string,
  data?: Record<string, unknown>,
): ToolResult {
  return { success: true, message, data };
}

export function fail(message: string): ToolResult {
  return { success: false, message };
}

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((i) =>
      i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message,
    )
    .join("; ");
}

export function splitParagraphs(content: string): string[] {
  return content.split(/\n\n+/).filter((p) => p.trim());
}

export const SCENE_BREAK_RE = /^[-*]{3,}$|^\*\s\*\s\*$/;
