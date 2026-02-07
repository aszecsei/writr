import CharacterCount from "@tiptap/extension-character-count";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import type { Comment } from "@/db/schemas";
import type { SpellcheckService } from "@/lib/spellcheck";
import { Comments } from "./Comments";
import { Indent } from "./Indent";
import { Ruby } from "./Ruby";
import { SearchAndReplace } from "./SearchAndReplace";
import { SelectionPreserver } from "./SelectionPreserver";
import { Spellcheck } from "./Spellcheck";
import { TypewriterScrolling } from "./TypewriterScrolling";

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
}

export function createExtensions(options?: ExtensionOptions) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
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
  ];
}
