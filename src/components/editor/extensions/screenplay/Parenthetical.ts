import { Node, textblockTypeInputRule } from "@tiptap/core";

export const Parenthetical = Node.create({
  name: "parenthetical",
  group: "block",
  content: "inline*",

  parseHTML() {
    return [{ tag: 'p[data-type="parenthetical"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      {
        ...HTMLAttributes,
        "data-type": "parenthetical",
        class: "screenplay-parenthetical",
      },
      0,
    ];
  },

  addInputRules() {
    return [
      // Opening paren at start of a dialogue block
      textblockTypeInputRule({
        find: /^\(/,
        type: this.type,
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (!editor.isActive("parenthetical")) return false;
        // After parenthetical, return to dialogue
        return editor.commands.insertContent({
          type: "dialogue",
        });
      },
    };
  },
});
