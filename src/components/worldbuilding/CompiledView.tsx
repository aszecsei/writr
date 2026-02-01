"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState } from "react";
import { Markdown } from "tiptap-markdown";

export function CompiledView({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      Markdown.configure({
        html: false,
      }),
    ],
    content: markdown,
    editable: false,
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && markdown !== undefined) {
      editor.commands.setContent(markdown);
    }
  }, [editor, markdown]);

  async function handleCopy() {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {copied ? "Copied!" : "Copy Markdown"}
        </button>
      </div>
      {markdown ? (
        <div className="prose prose-zinc dark:prose-invert max-w-none">
          <EditorContent editor={editor} />
        </div>
      ) : (
        <p className="py-12 text-center text-sm text-zinc-400 dark:text-zinc-500">
          No worldbuilding content to compile.
        </p>
      )}
    </div>
  );
}
