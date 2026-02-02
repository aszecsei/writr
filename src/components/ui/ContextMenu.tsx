"use client";

import type { LucideIcon } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef } from "react";

interface ContextMenuProps {
  children: ReactNode;
  position: { x: number; y: number };
  onClose: () => void;
}

export function ContextMenu({ children, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

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
      className="fixed z-50 min-w-[160px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      style={{ left: position.x, top: position.y }}
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
      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";

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
  return <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />;
}

interface ContextMenuLabelProps {
  children: ReactNode;
}

export function ContextMenuLabel({ children }: ContextMenuLabelProps) {
  return (
    <div className="px-3 py-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">
      {children}
    </div>
  );
}
