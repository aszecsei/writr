import ReactMarkdown from "react-markdown";

interface MarkdownMessageProps {
  content: string;
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none break-words [&_pre]:overflow-x-auto [&_code]:break-all [&_pre_code]:break-normal">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
