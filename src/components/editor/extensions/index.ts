import CharacterCount from "@tiptap/extension-character-count";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { TypewriterScrolling } from "./TypewriterScrolling";

export interface ExtensionOptions {
  typewriterScrollingRef?: { current: boolean };
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
    Typography,
    Markdown.configure({
      html: false,
      transformCopiedText: true,
      transformPastedText: true,
    }),
    TypewriterScrolling.configure({
      enabledRef: options?.typewriterScrollingRef ?? { current: false },
    }),
  ];
}
