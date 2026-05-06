import Bold from "@tiptap/extension-bold";
import CharacterCount from "@tiptap/extension-character-count";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Document from "@tiptap/extension-document";
import Image from "@tiptap/extension-image";
import Italic from "@tiptap/extension-italic";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Text from "@tiptap/extension-text";
import TextAlign from "@tiptap/extension-text-align";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import { UndoRedo } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";
import type { Comment } from "@/db/schemas";
import type { SpellcheckService } from "@/lib/spellcheck";
import { Comments } from "./Comments";
import { Indent } from "./Indent";
import { Ruby } from "./Ruby";
import { SearchAndReplace } from "./SearchAndReplace";
import { SelectionPreserver } from "./SelectionPreserver";
import { Spellcheck } from "./Spellcheck";
import {
  Action,
  Centered,
  Character,
  Dialogue,
  Parenthetical,
  SceneHeading,
  ScreenplayPageBreak,
  Transition,
} from "./screenplay";
import { TypewriterScrolling } from "./TypewriterScrolling";

/**
 * When passed to `createExtensions`, the editor will bind to a shared
 * Y.Doc and emit awareness updates over the supplied Awareness instance.
 * StarterKit's UndoRedo is disabled so we don't double-track history
 * against Yjs.
 */
export interface CollabExtensionConfig {
  doc: Y.Doc;
  awareness: Awareness;
  /** Display name surfaced over the local user's caret. */
  userName?: string;
  /** Hex color for the caret + selection highlight. */
  userColor?: string;
  /**
   * Fires after Yjs has rendered the prose Y.Doc into PM at least once.
   * Callers gate `editor`-bound work (e.g. comment-anchor encoding) on
   * this signal so they don't operate against a half-built y-prosemirror
   * mapping. See `CollabProseEditor.tsx` for the canonical pattern.
   */
  onFirstRender?: () => void;
}

export interface ExtensionOptions {
  typewriterScrollingRef?: { current: boolean };
  commentsRef?: { current: Comment[] };
  spellcheckerRef?: { current: SpellcheckService | null };
  customWordsRef?: { current: Set<string> };
  spellcheckEnabledRef?: { current: boolean };
  ignoredWordsRef?: { current: Set<string> };
  onSpellcheckContextMenu?: (
    word: string,
    from: number,
    to: number,
    suggestions: string[],
    rect: DOMRect,
  ) => void;
  onSelectionChange?: (text: string, from: number, to: number) => void;
  onSelectionClear?: () => void;
  /**
   * If present, the prose extensions will be augmented with the TipTap
   * Collaboration + CollaborationCaret extensions, and StarterKit's
   * UndoRedo will be disabled (Yjs ships its own history).
   */
  collab?: CollabExtensionConfig;
}

export function createExtensions(options?: ExtensionOptions) {
  const collab = options?.collab;
  const starterKitConfig: Parameters<typeof StarterKit.configure>[0] = {
    heading: { levels: [1, 2, 3] },
  };
  if (collab) {
    // Suppress StarterKit's history so it doesn't fight Yjs.
    (starterKitConfig as Record<string, unknown>).undoRedo = false;
  }
  return [
    StarterKit.configure(starterKitConfig),
    Placeholder.configure({
      placeholder: "Start writing...",
    }),
    CharacterCount,
    Underline,
    Link.configure({
      openOnClick: false,
      autolink: true,
    }),
    Image.configure({
      inline: false,
      allowBase64: false,
    }),
    TextAlign.configure({
      types: ["heading", "paragraph"],
      alignments: ["left", "center", "right", "justify"],
      defaultAlignment: "left",
    }),
    Indent,
    Ruby,
    Typography,
    Markdown.configure({
      html: true,
      transformCopiedText: true,
      transformPastedText: true,
    }),
    TypewriterScrolling.configure({
      enabledRef: options?.typewriterScrollingRef ?? { current: false },
    }),
    Comments.configure({
      commentsRef: options?.commentsRef ?? { current: [] },
    }),
    Spellcheck.configure({
      spellcheckerRef: options?.spellcheckerRef,
      customWordsRef: options?.customWordsRef,
      enabledRef: options?.spellcheckEnabledRef,
      ignoredWordsRef: options?.ignoredWordsRef,
      onContextMenu: options?.onSpellcheckContextMenu,
    }),
    SelectionPreserver.configure({
      onSelectionChange: options?.onSelectionChange,
      onSelectionClear: options?.onSelectionClear,
    }),
    SearchAndReplace,
    ...(collab
      ? [
          Collaboration.configure({
            document: collab.doc,
            onFirstRender: collab.onFirstRender,
          }),
          CollaborationCaret.configure({
            // The caret extension only reads `provider.awareness`; the
            // CollabClient already pumps encrypted awareness updates
            // into this instance, so a stub provider is sufficient.
            provider: { awareness: collab.awareness },
            user: {
              name: collab.userName ?? "Host",
              color: collab.userColor ?? "#10b981",
            },
          }),
        ]
      : []),
  ];
}

const SCREENPLAY_PLACEHOLDERS: Record<string, string> = {
  sceneHeading: "INT./EXT. LOCATION - TIME",
  action: "Describe the action...",
  character: "CHARACTER NAME",
  dialogue: "Dialogue...",
  parenthetical: "(parenthetical)",
  transition: "TRANSITION:",
  centered: "Centered text",
};

export function createScreenplayExtensions(options?: ExtensionOptions) {
  return [
    Document,
    Text,
    // Screenplay block nodes
    SceneHeading,
    Action,
    Character,
    Dialogue,
    Parenthetical,
    Transition,
    Centered,
    ScreenplayPageBreak,
    // Inline formatting
    Bold,
    Italic,
    Underline,
    // History (undo/redo)
    UndoRedo,
    // Shared behavior
    Placeholder.configure({
      placeholder: ({ node }) =>
        SCREENPLAY_PLACEHOLDERS[node.type.name] ?? "Start writing...",
    }),
    CharacterCount,
    TypewriterScrolling.configure({
      enabledRef: options?.typewriterScrollingRef ?? { current: false },
    }),
    Comments.configure({
      commentsRef: options?.commentsRef ?? { current: [] },
    }),
    Spellcheck.configure({
      spellcheckerRef: options?.spellcheckerRef,
      customWordsRef: options?.customWordsRef,
      enabledRef: options?.spellcheckEnabledRef,
      ignoredWordsRef: options?.ignoredWordsRef,
      onContextMenu: options?.onSpellcheckContextMenu,
    }),
    SelectionPreserver.configure({
      onSelectionChange: options?.onSelectionChange,
      onSelectionClear: options?.onSelectionClear,
    }),
    SearchAndReplace,
  ];
}
