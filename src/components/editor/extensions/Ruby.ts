import { Mark, mergeAttributes } from "@tiptap/core";

export interface RubyOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    ruby: {
      setRuby: (attributes: { annotation: string }) => ReturnType;
      unsetRuby: () => ReturnType;
    };
  }
}

export const Ruby = Mark.create<RubyOptions>({
  name: "ruby",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      annotation: {
        default: null,
        parseHTML: (element) => {
          const rt = element.querySelector("rt");
          return rt?.textContent ?? null;
        },
        renderHTML: (attributes) => {
          return {
            "data-annotation": attributes.annotation,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "ruby",
      },
    ];
  },

  renderHTML({ HTMLAttributes, mark }) {
    // Render as ruby with rt element
    // Note: We use a custom rendering approach because TipTap marks
    // don't natively support nested elements like <ruby><rt></rt></ruby>
    return [
      "ruby",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      ["span", { class: "ruby-base" }, 0],
      ["rt", {}, mark.attrs.annotation || ""],
    ];
  },

  addCommands() {
    return {
      setRuby:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },

      unsetRuby:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});
