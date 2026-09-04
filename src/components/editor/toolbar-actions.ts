import type { Editor } from "@tiptap/react";
import type { LucideIcon } from "lucide-react";
import {
  AlignCenter,
  ArrowRight,
  Bold,
  Clapperboard,
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
  MessageSquare,
  Parentheses,
  Quote,
  Redo2,
  SeparatorHorizontal,
  Strikethrough,
  Underline,
  Undo2,
  User,
  Zap,
} from "lucide-react";

export type ToolbarGroup =
  | "text"
  | "link"
  | "heading"
  | "align"
  | "block"
  | "indent"
  | "history"
  | "screenplay";

/** Modal ids a "modal" action can open — see `uiStore`'s `ModalState`. */
export type ToolbarActionModal = "link-editor" | "insert-image" | "ruby-editor";

interface ToolbarActionBase {
  label: string;
  icon: LucideIcon;
  isActive?: (editor: Editor) => boolean;
  group: ToolbarGroup;
}

export type ToolbarAction =
  | (ToolbarActionBase & { kind: "command"; run: (editor: Editor) => void })
  | (ToolbarActionBase & { kind: "modal"; modal: ToolbarActionModal });

export const actions: ToolbarAction[] = [
  {
    label: "Bold",
    icon: Bold,
    kind: "command",
    run: (e) => e.chain().focus().toggleBold().run(),
    isActive: (e) => e.isActive("bold"),
    group: "text",
  },
  {
    label: "Italic",
    icon: Italic,
    kind: "command",
    run: (e) => e.chain().focus().toggleItalic().run(),
    isActive: (e) => e.isActive("italic"),
    group: "text",
  },
  {
    label: "Underline",
    icon: Underline,
    kind: "command",
    run: (e) => e.chain().focus().toggleUnderline().run(),
    isActive: (e) => e.isActive("underline"),
    group: "text",
  },
  {
    label: "Strikethrough",
    icon: Strikethrough,
    kind: "command",
    run: (e) => e.chain().focus().toggleStrike().run(),
    isActive: (e) => e.isActive("strike"),
    group: "text",
  },
  {
    label: "Link",
    icon: Link2,
    kind: "modal",
    modal: "link-editor",
    isActive: (e) => e.isActive("link"),
    group: "link",
  },
  {
    label: "Image",
    icon: ImagePlus,
    kind: "modal",
    modal: "insert-image",
    group: "link",
  },
  {
    label: "Heading 1",
    icon: Heading1,
    kind: "command",
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    isActive: (e) => e.isActive("heading", { level: 1 }),
    group: "heading",
  },
  {
    label: "Heading 2",
    icon: Heading2,
    kind: "command",
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (e) => e.isActive("heading", { level: 2 }),
    group: "heading",
  },
  {
    label: "Heading 3",
    icon: Heading3,
    kind: "command",
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    isActive: (e) => e.isActive("heading", { level: 3 }),
    group: "heading",
  },
  {
    label: "Blockquote",
    icon: Quote,
    kind: "command",
    run: (e) => e.chain().focus().toggleBlockquote().run(),
    isActive: (e) => e.isActive("blockquote"),
    group: "block",
  },
  {
    label: "Bullet List",
    icon: List,
    kind: "command",
    run: (e) => e.chain().focus().toggleBulletList().run(),
    isActive: (e) => e.isActive("bulletList"),
    group: "block",
  },
  {
    label: "Ordered List",
    icon: ListOrdered,
    kind: "command",
    run: (e) => e.chain().focus().toggleOrderedList().run(),
    isActive: (e) => e.isActive("orderedList"),
    group: "block",
  },
  {
    label: "Code Block",
    icon: Code,
    kind: "command",
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
    isActive: (e) => e.isActive("codeBlock"),
    group: "block",
  },
  {
    // Insert a scene break (Model D): starts a new scene at the cursor, or —
    // with a selection — begins a new scene at the selection start. The backing
    // Scene row is created by the editor's save-path reconcile.
    label: "Scene Break",
    icon: SeparatorHorizontal,
    kind: "command",
    run: (e) => {
      const { from } = e.state.selection;
      e.chain()
        .focus()
        .insertContentAt(from, {
          type: "sceneBreak",
          attrs: { sceneId: crypto.randomUUID() },
        })
        .run();
    },
    isActive: (e) => e.isActive("sceneBreak"),
    group: "block",
  },
  {
    label: "Indent",
    icon: IndentIncrease,
    kind: "command",
    run: (e) => {
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
    kind: "command",
    run: (e) => {
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
    kind: "modal",
    modal: "ruby-editor",
    isActive: (e) => e.isActive("ruby"),
    group: "text",
  },
  {
    label: "Undo",
    icon: Undo2,
    kind: "command",
    run: (e) => e.chain().focus().undo().run(),
    group: "history",
  },
  {
    label: "Redo",
    icon: Redo2,
    kind: "command",
    run: (e) => e.chain().focus().redo().run(),
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

/** Screenplay element-type buttons (scene heading, action, dialogue, …). */
export const screenplayElementActions: ToolbarAction[] = [
  {
    label: "Scene",
    icon: Clapperboard,
    kind: "command",
    run: (e) => e.chain().focus().setNode("sceneHeading").run(),
    isActive: (e) => e.isActive("sceneHeading"),
    group: "screenplay",
  },
  {
    label: "Action",
    icon: Zap,
    kind: "command",
    run: (e) => e.chain().focus().setNode("action").run(),
    isActive: (e) => e.isActive("action"),
    group: "screenplay",
  },
  {
    label: "Character",
    icon: User,
    kind: "command",
    run: (e) => e.chain().focus().setNode("character").run(),
    isActive: (e) => e.isActive("character"),
    group: "screenplay",
  },
  {
    label: "Dialogue",
    icon: MessageSquare,
    kind: "command",
    run: (e) => e.chain().focus().setNode("dialogue").run(),
    isActive: (e) => e.isActive("dialogue"),
    group: "screenplay",
  },
  {
    label: "Paren",
    icon: Parentheses,
    kind: "command",
    run: (e) => e.chain().focus().setNode("parenthetical").run(),
    isActive: (e) => e.isActive("parenthetical"),
    group: "screenplay",
  },
  {
    label: "Transition",
    icon: ArrowRight,
    kind: "command",
    run: (e) => e.chain().focus().setNode("transition").run(),
    isActive: (e) => e.isActive("transition"),
    group: "screenplay",
  },
  {
    label: "Centered",
    icon: AlignCenter,
    kind: "command",
    run: (e) => e.chain().focus().setNode("centered").run(),
    isActive: (e) => e.isActive("centered"),
    group: "screenplay",
  },
];
