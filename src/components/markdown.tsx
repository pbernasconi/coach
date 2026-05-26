import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { marked } from 'marked';
import 'highlight.js/styles/github-dark.css';

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map((token) => token.raw);
}

const MemoizedMarkdownBlock = memo(
  ({ content }: { content: string }) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code: ({ node, inline, className, children, ...props }: any) => {
            if (inline) {
              return (
                <code className="bg-gray-200 px-1 py-0.5 rounded text-sm" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className={`${className} text-sm`} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }: any) => (
            <pre className="bg-gray-800 text-gray-100 p-3 rounded-md overflow-x-auto my-2">
              {children}
            </pre>
          ),
          p: ({ children }: any) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }: any) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
          ol: ({ children }: any) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
          li: ({ children }: any) => <li className="ml-2">{children}</li>,
          h1: ({ children }: any) => <h1 className="text-xl font-bold mb-2 mt-3">{children}</h1>,
          h2: ({ children }: any) => <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>,
          h3: ({ children }: any) => <h3 className="text-base font-bold mb-1 mt-2">{children}</h3>,
          blockquote: ({ children }: any) => (
            <blockquote className="border-l-4 border-gray-300 pl-3 italic my-2">{children}</blockquote>
          ),
          a: ({ href, children }: any) => (
            <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    );
  },
  (prevProps, nextProps) => prevProps.content === nextProps.content
);

MemoizedMarkdownBlock.displayName = 'MemoizedMarkdownBlock';

export const MemoizedMarkdown = memo(
  ({ content, id }: { content: string; id: string }) => {
    const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);

    return (
      <>
        {blocks.map((block, index) => (
          <MemoizedMarkdownBlock content={block} key={`${id}-block_${index}`} />
        ))}
      </>
    );
  }
);

MemoizedMarkdown.displayName = 'MemoizedMarkdown';
