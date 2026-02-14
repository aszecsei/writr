import { Node } from "@tiptap/core";

export const Dialogue = Node.create({
  name: "dialogue",
  group: "block",
  content: "inline*",
  defining: true,

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
        const { $from } = editor.state.selection;
        if ($from.parent.content.size === 0) {
          return editor.commands.setNode("action");
        }
        return editor.chain().splitBlock().setNode("dialogue").run();
      },
      Tab: ({ editor }) => {
        if (!editor.isActive("dialogue")) return false;
        return editor.commands.setNode("parenthetical");
      },
    };
  },
});
