import { Node } from "@tiptap/core";

export const Action = Node.create({
  name: "action",
  group: "block",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: 'p[data-type="action"]' }, { tag: "p", priority: 0 }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      {
        ...HTMLAttributes,
        "data-type": "action",
        class: "screenplay-action",
      },
      0,
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (!editor.isActive("action")) return false;
        const { $from } = editor.state.selection;
        if ($from.parent.content.size === 0) {
          return editor.commands.setNode("sceneHeading");
        }
        return editor.chain().splitBlock().setNode("action").run();
      },
      Tab: ({ editor }) => {
        if (!editor.isActive("action")) return false;
        return editor.commands.setNode("character");
      },
    };
  },
});
