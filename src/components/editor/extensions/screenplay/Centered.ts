import { Node } from "@tiptap/core";

export const Centered = Node.create({
  name: "centered",
  group: "block",
  content: "inline*",

  parseHTML() {
    return [{ tag: 'p[data-type="centered"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      {
        ...HTMLAttributes,
        "data-type": "centered",
        class: "screenplay-centered",
      },
      0,
    ];
  },
});
