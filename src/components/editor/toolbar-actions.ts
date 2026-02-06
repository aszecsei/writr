import type { Editor } from "@tiptap/react";
import type { LucideIcon } from "lucide-react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Languages,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";

export type ToolbarGroup =
  | "text"
  | "link"
  | "heading"
  | "align"
  | "block"
  | "indent"
  | "history";

export interface ToolbarAction {
  label: string;
  icon: LucideIcon;
  action: (editor: Editor) => void;
  isActive?: (editor: Editor) => boolean;
  group: ToolbarGroup;
  /** If true, action opens a modal and needs special handling */
  opensModal?: boolean;
}

export const actions: ToolbarAction[] = [
  {
    label: "Bold",
    icon: Bold,
    action: (e) => e.chain().focus().toggleBold().run(),
    isActive: (e) => e.isActive("bold"),
    group: "text",
  },
  {
    label: "Italic",
    icon: Italic,
    action: (e) => e.chain().focus().toggleItalic().run(),
    isActive: (e) => e.isActive("italic"),
    group: "text",
  },
  {
    label: "Underline",
    icon: Underline,
    action: (e) => e.chain().focus().toggleUnderline().run(),
    isActive: (e) => e.isActive("underline"),
    group: "text",
  },
  {
    label: "Strikethrough",
    icon: Strikethrough,
    action: (e) => e.chain().focus().toggleStrike().run(),
    isActive: (e) => e.isActive("strike"),
    group: "text",
  },
  {
    label: "Link",
    icon: Link2,
    action: () => {}, // Handled specially in EditorToolbar
    isActive: (e) => e.isActive("link"),
    group: "link",
    opensModal: true,
  },
  {
    label: "Image",
    icon: ImagePlus,
    action: () => {}, // Handled specially in EditorToolbar
    group: "link",
    opensModal: true,
  },
  {
    label: "Heading 1",
    icon: Heading1,
    action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    isActive: (e) => e.isActive("heading", { level: 1 }),
    group: "heading",
  },
  {
    label: "Heading 2",
    icon: Heading2,
    action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (e) => e.isActive("heading", { level: 2 }),
    group: "heading",
  },
  {
    label: "Heading 3",
    icon: Heading3,
    action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    isActive: (e) => e.isActive("heading", { level: 3 }),
    group: "heading",
  },
  {
    label: "Blockquote",
    icon: Quote,
    action: (e) => e.chain().focus().toggleBlockquote().run(),
    isActive: (e) => e.isActive("blockquote"),
    group: "block",
  },
  {
    label: "Bullet List",
    icon: List,
    action: (e) => e.chain().focus().toggleBulletList().run(),
    isActive: (e) => e.isActive("bulletList"),
    group: "block",
  },
  {
    label: "Ordered List",
    icon: ListOrdered,
    action: (e) => e.chain().focus().toggleOrderedList().run(),
    isActive: (e) => e.isActive("orderedList"),
    group: "block",
  },
  {
    label: "Code Block",
    icon: Code,
    action: (e) => e.chain().focus().toggleCodeBlock().run(),
    isActive: (e) => e.isActive("codeBlock"),
    group: "block",
  },
  {
    label: "Indent",
    icon: IndentIncrease,
    action: (e) => {
      if (e.isActive("listItem")) {
        e.chain().focus().sinkListItem("listItem").run();
      } else {
        e.chain().focus().indent().run();
      }
    },
    group: "indent",
  },
  {
    label: "Outdent",
    icon: IndentDecrease,
    action: (e) => {
      if (e.isActive("listItem")) {
        e.chain().focus().liftListItem("listItem").run();
      } else {
        e.chain().focus().outdent().run();
      }
    },
    group: "indent",
  },
  {
    label: "Ruby Text",
    icon: Languages,
    action: () => {}, // Handled specially in EditorToolbar
    isActive: (e) => e.isActive("ruby"),
    group: "text",
    opensModal: true,
  },
  {
    label: "Undo",
    icon: Undo2,
    action: (e) => e.chain().focus().undo().run(),
    group: "history",
  },
  {
    label: "Redo",
    icon: Redo2,
    action: (e) => e.chain().focus().redo().run(),
    group: "history",
  },
];

export const groups: ToolbarGroup[] = [
  "text",
  "link",
  "heading",
  "align",
  "block",
  "indent",
  "history",
];
