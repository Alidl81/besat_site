"use client";

import { sanitizeCmsHtml } from "@/lib/content/sanitize-cms-html";
import { safePublicMediaUrl } from "@/lib/media/safe-url";
import type { PublicNewsDetail } from "@/types/public-content";

type Block = NonNullable<PublicNewsDetail["content_json"]["blocks"]>[number];

function HtmlText({ value }: { value: unknown }) {
  if (typeof value !== "string" || !value.trim()) return null;
  return <span dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(value) }} />;
}

function ListItems({ items }: { items: unknown }) {
  if (!Array.isArray(items)) return null;
  return (
    <>
      {items.map((item, index) => {
        const content =
          typeof item === "string"
            ? item
            : item && typeof item === "object" && "content" in item
              ? (item as { content?: unknown }).content
              : "";
        const children =
          item && typeof item === "object" && "items" in item
            ? (item as { items?: unknown }).items
            : null;
        return (
          <li key={index}>
            <HtmlText value={content} />
            {Array.isArray(children) && children.length > 0 ? (
              <ul>
                <ListItems items={children} />
              </ul>
            ) : null}
          </li>
        );
      })}
    </>
  );
}

function ContentBlock({ block }: { block: Block }) {
  const data = block.data;

  if (block.type === "paragraph") {
    return (
      <p>
        <HtmlText value={data.text} />
      </p>
    );
  }

  if (block.type === "header") {
    const level =
      typeof data.level === "number" && data.level >= 2 && data.level <= 6
        ? data.level
        : 2;
    const Heading = `h${level}` as keyof React.JSX.IntrinsicElements;
    return (
      <Heading>
        <HtmlText value={data.text} />
      </Heading>
    );
  }

  if (block.type === "list") {
    const List = data.style === "ordered" ? "ol" : "ul";
    return (
      <List>
        <ListItems items={data.items} />
      </List>
    );
  }

  if (block.type === "quote") {
    return (
      <figure>
        <blockquote>
          <HtmlText value={data.text} />
        </blockquote>
        {data.caption ? (
          <figcaption>
            <HtmlText value={data.caption} />
          </figcaption>
        ) : null}
      </figure>
    );
  }

  if (block.type === "delimiter") {
    return <hr />;
  }

  if (block.type === "image") {
    const file =
      data.file && typeof data.file === "object"
        ? (data.file as { url?: unknown })
        : null;
    const src = safePublicMediaUrl(
      typeof file?.url === "string" ? file.url : null,
    );
    if (!src) return null;
    const caption = typeof data.caption === "string" ? data.caption : "";
    return (
      <figure>
        <img src={src} alt={caption} loading="lazy" />
        {caption ? (
          <figcaption>
            <HtmlText value={caption} />
          </figcaption>
        ) : null}
      </figure>
    );
  }

  return null;
}

export function EditorJsContentRenderer({
  content,
}: {
  content: PublicNewsDetail["content_json"];
}) {
  const blocks = Array.isArray(content?.blocks) ? content.blocks : [];
  return (
    <div className="besat-rich-content mt-8 max-w-none text-right text-base font-medium leading-9 text-slate-700">
      {blocks.map((block, index) => (
        <ContentBlock key={block.id ?? `${block.type}-${index}`} block={block} />
      ))}
    </div>
  );
}
