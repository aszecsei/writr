import type { CommentColor } from "@/db/schemas";

export const COMMENT_COLORS: CommentColor[] = [
  "yellow",
  "blue",
  "green",
  "red",
  "purple",
];

export const CARD_BORDER_COLOR: Record<CommentColor, string> = {
  yellow: "border-l-yellow-400 dark:border-l-yellow-500",
  blue: "border-l-blue-400 dark:border-l-blue-500",
  green: "border-l-green-400 dark:border-l-green-500",
  red: "border-l-red-400 dark:border-l-red-500",
  purple: "border-l-purple-400 dark:border-l-purple-500",
};

export const COLOR_BUTTON_CLASSES: Record<CommentColor, string> = {
  yellow: "bg-yellow-400 hover:bg-yellow-500",
  blue: "bg-blue-400 hover:bg-blue-500",
  green: "bg-green-400 hover:bg-green-500",
  red: "bg-red-400 hover:bg-red-500",
  purple: "bg-purple-400 hover:bg-purple-500",
};

export const MARKER_CLASSES: Record<CommentColor, string> = {
  yellow: "comment-marker-yellow",
  blue: "comment-marker-blue",
  green: "comment-marker-green",
  red: "comment-marker-red",
  purple: "comment-marker-purple",
};

export const HIGHLIGHT_CLASSES: Record<CommentColor, string> = {
  yellow: "comment-highlight-yellow",
  blue: "comment-highlight-blue",
  green: "comment-highlight-green",
  red: "comment-highlight-red",
  purple: "comment-highlight-purple",
};
