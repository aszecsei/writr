import { Node } from "@tiptap/core";

export const Dialogue = Node.create({
  name: "dialogue",
  group: "block",
  content: "inline*",

  parseHTML() {
    return [{ tag: 'p[data-type="dialogue"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      {
        ...HTMLAttributes,
        "data-type": "dialogue",
        class: "screenplay-dialogue",
      },
      0,
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (!editor.isActive("dialogue")) return false;
        // After dialogue, default to action (user can switch to character)
        return editor.commands.insertContent({
          type: "action",
        });
      },
    };
  },
});
