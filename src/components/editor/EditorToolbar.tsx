"use client";

import type { Editor } from "@tiptap/react";
import { updateAppSettings } from "@/db/operations";
import { useAppSettings } from "@/hooks/useAppSettings";
import { EDITOR_FONTS, type EditorFont } from "@/lib/fonts";

interface EditorToolbarProps {
  editor: Editor | null;
}

interface ToolbarAction {
  label: string;
  action: (editor: Editor) => void;
  isActive?: (editor: Editor) => boolean;
}

const actions: ToolbarAction[] = [
  {
    label: "B",
    action: (e) => e.chain().focus().toggleBold().run(),
    isActive: (e) => e.isActive("bold"),
  },
  {
    label: "I",
    action: (e) => e.chain().focus().toggleItalic().run(),
    isActive: (e) => e.isActive("italic"),
  },
  {
    label: "U",
    action: (e) => e.chain().focus().toggleUnderline().run(),
    isActive: (e) => e.isActive("underline"),
  },
  {
    label: "S",
    action: (e) => e.chain().focus().toggleStrike().run(),
    isActive: (e) => e.isActive("strike"),
  },
  {
    label: "H1",
    action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    isActive: (e) => e.isActive("heading", { level: 1 }),
  },
  {
    label: "H2",
    action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (e) => e.isActive("heading", { level: 2 }),
  },
  {
    label: "H3",
    action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    isActive: (e) => e.isActive("heading", { level: 3 }),
  },
  {
    label: "Quote",
    action: (e) => e.chain().focus().toggleBlockquote().run(),
    isActive: (e) => e.isActive("blockquote"),
  },
  {
    label: "Bullet",
    action: (e) => e.chain().focus().toggleBulletList().run(),
    isActive: (e) => e.isActive("bulletList"),
  },
  {
    label: "Ordered",
    action: (e) => e.chain().focus().toggleOrderedList().run(),
    isActive: (e) => e.isActive("orderedList"),
  },
  {
    label: "Code",
    action: (e) => e.chain().focus().toggleCodeBlock().run(),
    isActive: (e) => e.isActive("codeBlock"),
  },
  {
    label: "Undo",
    action: (e) => e.chain().focus().undo().run(),
  },
  {
    label: "Redo",
    action: (e) => e.chain().focus().redo().run(),
  },
];

const CATEGORY_LABELS: Record<EditorFont["category"], string> = {
  serif: "Serif",
  sans: "Sans-Serif",
  accessible: "Accessible",
};

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const settings = useAppSettings();
  const currentFont = settings?.editorFont ?? "literata";

  async function handleFontChange(e: React.ChangeEvent<HTMLSelectElement>) {
    await updateAppSettings({ editorFont: e.target.value });
  }

  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <label className="flex items-center gap-1">
        <span className="sr-only">Editor font</span>
        <select
          value={currentFont}
          onChange={handleFontChange}
          className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        >
          {(["serif", "sans", "accessible"] as const).map((cat) => (
            <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
              {EDITOR_FONTS.filter((f) => f.category === cat).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
      {actions.map((action) => {
        const active = action.isActive?.(editor) ?? false;
        return (
          <button
            key={action.label}
            type="button"
            onClick={() => action.action(editor)}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
