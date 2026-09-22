import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Wide tables (e.g. the API-endpoints table) would otherwise overflow
          // the page horizontally on mobile -- scope the scroll to the table.
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
