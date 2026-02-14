import { Node } from "@tiptap/core";

export const ScreenplayPageBreak = Node.create({
  name: "screenplayPageBreak",
  group: "block",
  atom: true,

  parseHTML() {
    return [{ tag: 'hr[data-type="screenplayPageBreak"]' }];
  },

  renderHTML() {
    return [
      "hr",
      {
        "data-type": "screenplayPageBreak",
        class: "screenplay-page-break",
      },
    ];
  },
});
