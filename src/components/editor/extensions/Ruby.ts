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
        contentElement: (element) => {
          // Use .ruby-base span if present (current format)
          const rubyBase = element.querySelector(".ruby-base");
          if (rubyBase instanceof HTMLElement) {
            return rubyBase;
          }
          // Fallback for legacy/pasted content without span wrapper:
          // Return a temp element with only non-<rt> content
          const temp = document.createElement("span");
          for (const child of element.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
              temp.appendChild(child.cloneNode(true));
            } else if (
              child instanceof HTMLElement &&
              child.tagName.toLowerCase() !== "rt"
            ) {
              temp.appendChild(child.cloneNode(true));
            }
          }
          return temp;
        },
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
