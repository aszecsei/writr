"use client";

import type { LucideIcon } from "lucide-react";
import type { MouseEventHandler } from "react";

type ToolbarButtonVariant = "default" | "active" | "success";
type ToolbarButtonSize = "sm" | "md";

interface ToolbarButtonProps {
  icon: LucideIcon;
  title: string;
  onClick?: () => void;
  onMouseDown?: MouseEventHandler<HTMLButtonElement>;
  variant?: ToolbarButtonVariant;
  disabled?: boolean;
  size?: ToolbarButtonSize;
  iconSize?: number;
  className?: string;
}

const SIZE_CLASSES: Record<ToolbarButtonSize, string> = {
  md: "rounded p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400",
  sm: "rounded p-0.5 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400",
};

const STATE_CLASSES: Record<
  ToolbarButtonSize,
  Record<ToolbarButtonVariant | "disabled", string>
> = {
  md: {
    default:
      "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800",
    active:
      "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100",
    success:
      "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    disabled: "cursor-not-allowed text-neutral-300 dark:text-neutral-600",
  },
  sm: {
    default:
      "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-500 dark:hover:bg-neutral-800",
    active:
      "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100",
    success:
      "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    disabled: "text-neutral-300 dark:text-neutral-600",
  },
};

const DEFAULT_ICON_SIZE: Record<ToolbarButtonSize, number> = { md: 16, sm: 12 };

export function ToolbarButton({
  icon: Icon,
  title,
  onClick,
  onMouseDown,
  variant = "default",
  disabled = false,
  size = "md",
  iconSize,
  className,
}: ToolbarButtonProps) {
  const stateKey = disabled ? "disabled" : variant;
  const classes = [SIZE_CLASSES[size], STATE_CLASSES[size][stateKey], className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseDown={onMouseDown}
      disabled={disabled}
      className={classes}
    >
      <Icon size={iconSize ?? DEFAULT_ICON_SIZE[size]} />
    </button>
  );
}
