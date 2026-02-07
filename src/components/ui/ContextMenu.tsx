"use client";

import type { LucideIcon } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

interface ContextMenuProps {
  children: ReactNode;
  position: { x: number; y: number };
  onClose: () => void;
}

export function ContextMenu({ children, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Measure menu and adjust position to stay within viewport
  useLayoutEffect(() => {
    // Reset to hidden while we measure
    setAdjustedPosition(null);

    if (!menuRef.current) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const padding = 8;

    let x = position.x;
    let y = position.y;

    // Check right overflow - position menu to left of click point
    if (x + rect.width > window.innerWidth - padding) {
      x = position.x - rect.width;
    }

    // Check bottom overflow - position menu above click point
    if (y + rect.height > window.innerHeight - padding) {
      y = position.y - rect.height;
    }

    // Clamp to ensure menu stays on screen
    x = Math.max(padding, x);
    y = Math.max(padding, y);

    setAdjustedPosition({ x, y });
  }, [position.x, position.y]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        handleClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
      style={{
        left: adjustedPosition?.x ?? position.x,
        top: adjustedPosition?.y ?? position.y,
        visibility: adjustedPosition ? "visible" : "hidden",
      }}
    >
      {children}
    </div>
  );
}

interface ContextMenuItemProps {
  children: ReactNode;
  icon?: LucideIcon;
  variant?: "default" | "danger";
  onClick: () => void;
}

export function ContextMenuItem({
  children,
  icon: Icon,
  variant = "default",
  onClick,
}: ContextMenuItemProps) {
  const styles =
    variant === "danger"
      ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
      : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800";

  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${styles}`}
      onClick={onClick}
    >
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

export function ContextMenuSeparator() {
  return (
    <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />
  );
}

interface ContextMenuLabelProps {
  children: ReactNode;
}

export function ContextMenuLabel({ children }: ContextMenuLabelProps) {
  return (
    <div className="px-3 py-1 text-xs font-medium text-neutral-400 dark:text-neutral-500">
      {children}
    </div>
  );
}
