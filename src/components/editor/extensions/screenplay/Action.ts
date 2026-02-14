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
});
