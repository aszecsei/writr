import { Node, textblockTypeInputRule } from "@tiptap/core";

export const SceneHeading = Node.create({
  name: "sceneHeading",
  group: "block",
  content: "inline*",

  addAttributes() {
    return {
      sceneNumber: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'p[data-type="sceneHeading"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      {
        ...HTMLAttributes,
        "data-type": "sceneHeading",
        class: "screenplay-scene-heading",
      },
      0,
    ];
  },

  addInputRules() {
    return [
      // INT. or EXT. or INT./EXT. at start of line
      textblockTypeInputRule({
        find: /^(INT\.|EXT\.|INT\.\/EXT\.) /,
        type: this.type,
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (!editor.isActive("sceneHeading")) return false;
        // After scene heading, create an action node
        return editor.commands.insertContent({
          type: "action",
        });
      },
    };
  },
});
