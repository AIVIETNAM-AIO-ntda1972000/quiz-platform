import { isValidElement, useEffect, useId, useState, type ReactNode } from "react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { MarkdownReadingPassage } from "./models";
import "katex/dist/katex.min.css";

function blockId(node: { position?: { start?: { offset?: number } } } | undefined): string | undefined {
  return node?.position?.start?.offset?.toString();
}

function MermaidDiagram({ source, onRendered }: { source: string; onRendered: () => void }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    void (async () => {
      try {
        const [{ default: mermaid }, { default: DOMPurify }] = await Promise.all([import("mermaid"), import("dompurify")]);
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", htmlLabels: false, maxTextSize: 10_000, maxEdges: 100,
          theme: document.documentElement.dataset.theme === "dark" ? "dark" : "default" });
        const { svg } = await mermaid.render(`quiz-mermaid-${id}`, source);
        if (!active) return;
        const safeSvg = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
        objectUrl = URL.createObjectURL(new Blob([safeSvg], { type: "image/svg+xml" }));
        setUrl(objectUrl);
        onRendered();
      } catch {
        if (active) setError("This diagram could not be rendered. Source:");
        onRendered();
      }
    })();
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id, source, onRendered]);

  if (error) return <figure className="reading-diagram-error"><figcaption>{error}</figcaption><pre><code>{source}</code></pre></figure>;
  return <figure className="reading-diagram">{url ? <img src={url} alt="Mermaid diagram" onLoad={onRendered} /> : <figcaption>Rendering diagram…</figcaption>}</figure>;
}

export function MarkdownPassage({ passage, onMediaReady }: { passage: MarkdownReadingPassage; onMediaReady: () => void }) {
  const assets = new Map(passage.assets?.map((asset) => [asset.id, asset]));
  const block = (tag: "h2" | "h3" | "h4" | "p" | "ul" | "ol", node: { position?: { start?: { offset?: number } } } | undefined, children: ReactNode, id?: string) => {
    const Tag = tag;
    return <Tag id={id} data-reading-block={blockId(node)}>{children}</Tag>;
  };

  return (
    <Markdown
      skipHtml
      urlTransform={(url, key) => key === "src" && url.startsWith("quiz-asset:") ? url : defaultUrlTransform(url)}
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, { trust: false, throwOnError: false }], rehypeSlug]}
      components={{
        h1: ({ node, children, id }) => block("h2", node, children, id),
        h2: ({ node, children, id }) => block("h3", node, children, id),
        h3: ({ node, children, id }) => block("h4", node, children, id),
        p: ({ node, children }) => block("p", node, children),
        ul: ({ node, children }) => block("ul", node, children),
        ol: ({ node, children }) => block("ol", node, children),
        table: ({ node, children }) => <div data-reading-block={blockId(node)} className="reading-table-wrap"><table>{children}</table></div>,
        pre: ({ node, children }) => {
          if (isValidElement(children)) {
            const props = children.props as { className?: string; children?: ReactNode };
            if (props.className === "language-mermaid") {
              return <div data-reading-block={blockId(node)}><MermaidDiagram source={String(props.children ?? "").replace(/\n$/, "")} onRendered={onMediaReady} /></div>;
            }
          }
          return <pre data-reading-block={blockId(node)}>{children}</pre>;
        },
        a: ({ href, children }) => href && (/^https:\/\//i.test(href) || href.startsWith("#"))
          ? <a href={href} target={href.startsWith("#") ? undefined : "_blank"} rel="noopener noreferrer">{children}</a>
          : <span>{children}</span>,
        img: ({ src, alt }) => {
          const asset = src?.startsWith("quiz-asset:") ? assets.get(src.slice("quiz-asset:".length)) : undefined;
          return asset ? <img className="reading-image" src={`data:${asset.mimeType};base64,${asset.base64}`} alt={alt ?? ""} onLoad={onMediaReady} /> : <span role="img" aria-label={alt ?? "Image unavailable"}>Image unavailable</span>;
        },
      }}
    >{passage.content}</Markdown>
  );
}
