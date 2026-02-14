import { Node } from "@tiptap/core";

export const Character = Node.create({
  name: "character",
  group: "block",
  content: "inline*",

  parseHTML() {
    return [{ tag: 'p[data-type="character"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      {
        ...HTMLAttributes,
        "data-type": "character",
        class: "screenplay-character",
      },
      0,
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (!editor.isActive("character")) return false;
        // After character name, create dialogue node
        return editor.commands.insertContent({
          type: "dialogue",
        });
      },
    };
  },
});
