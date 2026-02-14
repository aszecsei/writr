import { Node, textblockTypeInputRule } from "@tiptap/core";

export const Transition = Node.create({
  name: "transition",
  group: "block",
  content: "inline*",

  parseHTML() {
    return [{ tag: 'p[data-type="transition"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      {
        ...HTMLAttributes,
        "data-type": "transition",
        class: "screenplay-transition",
      },
      0,
    ];
  },

  addInputRules() {
    return [
      // Text ending with TO: at line start
      textblockTypeInputRule({
        find: /^[A-Z\s]+TO: $/,
        type: this.type,
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (!editor.isActive("transition")) return false;
        // After transition, create scene heading
        return editor.commands.insertContent({
          type: "sceneHeading",
        });
      },
      Tab: ({ editor }) => {
        if (!editor.isActive("transition")) return false;
        return editor.commands.setNode("character");
      },
    };
  },
});
