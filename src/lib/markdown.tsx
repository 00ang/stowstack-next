import React from "react";

interface MarkdownNode {
  type: string;
  content?: string;
  children?: MarkdownNode[];
  level?: number;
  items?: MarkdownNode[];
  ordered?: boolean;
  language?: string;
  alt?: string;
  url?: string;
  headers?: string[];
  rows?: string[][];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseMarkdown(text: string): MarkdownNode[] {
  const lines = text.split("\n");
  const nodes: MarkdownNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Fenced code blocks
    const fenceMatch = line.match(/^```(\w*)/);
    if (fenceMatch) {
      const language = fenceMatch[1] || "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing fence
      nodes.push({ type: "code", language, content: codeLines.join("\n") });
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      nodes.push({ type: "hr" });
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      nodes.push({
        type: "heading",
        level: headingMatch[1].length,
        content: headingMatch[2],
      });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      nodes.push({ type: "blockquote", content: quoteLines.join("\n") });
      continue;
    }

    // Table
    if (line.includes("|") && i + 1 < lines.length && /^\|?\s*[-:]+/.test(lines[i + 1])) {
      const headerLine = line.trim().replace(/^\||\|$/g, "");
      const headers = headerLine.split("|").map((h) => h.trim());
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        const rowLine = lines[i].trim().replace(/^\||\|$/g, "");
        rows.push(rowLine.split("|").map((c) => c.trim()));
        i++;
      }
      nodes.push({ type: "table", headers, rows });
      continue;
    }

    // Image (standalone line)
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      nodes.push({ type: "image", alt: imgMatch[1], url: imgMatch[2] });
      i++;
      continue;
    }

    // Unordered list
    if (line.match(/^[-*]\s/)) {
      const items: MarkdownNode[] = [];
      while (i < lines.length && lines[i].match(/^[-*]\s/)) {
        items.push({
          type: "list-item",
          content: lines[i].replace(/^[-*]\s/, ""),
        });
        i++;
      }
      nodes.push({ type: "list", ordered: false, items });
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\.\s/)) {
      const items: MarkdownNode[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        items.push({
          type: "list-item",
          content: lines[i].replace(/^\d+\.\s/, ""),
        });
        i++;
      }
      nodes.push({ type: "list", ordered: true, items });
      continue;
    }

    // Paragraph (collect consecutive non-empty lines)
    const pLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith(">") &&
      !lines[i].startsWith("```") &&
      !lines[i].match(/^[-*]\s/) &&
      !lines[i].match(/^\d+\.\s/) &&
      !(lines[i].includes("|") && i + 1 < lines.length && /^\|?\s*[-:]/.test(lines[i + 1] || "")) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      pLines.push(lines[i]);
      i++;
    }
    if (pLines.length > 0) {
      nodes.push({ type: "paragraph", content: pLines.join(" ") });
    }
  }

  return nodes;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code (must check before bold to avoid conflicts)
    const codeMatch = remaining.match(/`([^`]+)`/);
    if (codeMatch && codeMatch.index !== undefined) {
      const boldBefore = remaining.indexOf("**");
      const linkBefore = remaining.indexOf("[");
      // Only match inline code if it comes first
      if (
        (boldBefore === -1 || codeMatch.index <= boldBefore) &&
        (linkBefore === -1 || codeMatch.index <= linkBefore)
      ) {
        if (codeMatch.index > 0) {
          parts.push(remaining.slice(0, codeMatch.index));
        }
        parts.push(
          <code
            key={key++}
            style={{
              background: "var(--bg-elevated, #f5f4f0)",
              padding: "2px 6px",
              borderRadius: "4px",
              fontSize: "0.9em",
              fontFamily: "monospace",
            }}
          >
            {codeMatch[1]}
          </code>
        );
        remaining = remaining.slice(codeMatch.index + codeMatch[0].length);
        continue;
      }
    }

    // Strikethrough
    const strikeMatch = remaining.match(/~~(.*?)~~/);
    if (strikeMatch && strikeMatch.index !== undefined) {
      const boldBefore = remaining.indexOf("**");
      if (boldBefore === -1 || strikeMatch.index <= boldBefore) {
        if (strikeMatch.index > 0) {
          parts.push(remaining.slice(0, strikeMatch.index));
        }
        parts.push(
          <del key={key++} style={{ color: "var(--text-tertiary)" }}>
            {strikeMatch[1]}
          </del>
        );
        remaining = remaining.slice(strikeMatch.index + strikeMatch[0].length);
        continue;
      }
    }

    // Bold
    const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        // Check for italic in the text before bold
        const before = remaining.slice(0, boldMatch.index);
        const italicInBefore = before.match(/\*([^*]+)\*/);
        if (italicInBefore && italicInBefore.index !== undefined) {
          if (italicInBefore.index > 0) {
            parts.push(before.slice(0, italicInBefore.index));
          }
          parts.push(
            <em key={key++} style={{ fontStyle: "italic" }}>
              {italicInBefore[1]}
            </em>
          );
          remaining = before.slice(italicInBefore.index + italicInBefore[0].length) + remaining.slice(boldMatch.index);
          continue;
        }
        parts.push(before);
      }
      parts.push(
        <strong key={key++} style={{ color: "var(--text-primary)" }}>
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }

    // Italic (single asterisk, not double)
    const italicMatch = remaining.match(/\*([^*]+)\*/);
    if (italicMatch && italicMatch.index !== undefined) {
      if (italicMatch.index > 0) {
        parts.push(remaining.slice(0, italicMatch.index));
      }
      parts.push(
        <em key={key++} style={{ fontStyle: "italic" }}>
          {italicMatch[1]}
        </em>
      );
      remaining = remaining.slice(italicMatch.index + italicMatch[0].length);
      continue;
    }

    // Link
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch && linkMatch.index !== undefined) {
      if (linkMatch.index > 0) {
        parts.push(remaining.slice(0, linkMatch.index));
      }
      parts.push(
        <a
          key={key++}
          href={linkMatch[2]}
          style={{ color: "var(--accent)", textDecoration: "underline" }}
        >
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch.index + linkMatch[0].length);
      continue;
    }

    // Inline image within paragraph text
    const inlineImgMatch = remaining.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    if (inlineImgMatch && inlineImgMatch.index !== undefined) {
      if (inlineImgMatch.index > 0) {
        parts.push(remaining.slice(0, inlineImgMatch.index));
      }
      parts.push(
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={key++}
          src={inlineImgMatch[2]}
          alt={inlineImgMatch[1]}
          style={{ maxWidth: "100%", borderRadius: "8px", margin: "8px 0" }}
        />
      );
      remaining = remaining.slice(inlineImgMatch.index + inlineImgMatch[0].length);
      continue;
    }

    parts.push(remaining);
    break;
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

/** Extract heading items for table of contents */
export function extractHeadings(
  content: string
): { id: string; text: string; level: number }[] {
  const headings: { id: string; text: string; level: number }[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.*)/);
    if (match) {
      const text = match[2].replace(/\*\*([^*]+)\*\*/g, "$1"); // strip bold
      headings.push({
        id: slugify(text),
        text,
        level: match[1].length,
      });
    }
  }
  return headings;
}

export function MarkdownRenderer({ content }: { content: string }) {
  const nodes = parseMarkdown(content);

  return (
    <div className="blog-content">
      {nodes.map((node, i) => {
        switch (node.type) {
          case "heading": {
            const Tag = `h${node.level}` as keyof React.JSX.IntrinsicElements;
            const headingText = (node.content || "").replace(/\*\*([^*]+)\*\*/g, "$1");
            return (
              <Tag key={i} id={slugify(headingText)} className={`blog-h${node.level}`}>
                {renderInline(node.content || "")}
              </Tag>
            );
          }
          case "paragraph":
            return <p key={i}>{renderInline(node.content || "")}</p>;
          case "blockquote":
            return (
              <blockquote key={i}>
                {renderInline(node.content || "")}
              </blockquote>
            );
          case "list": {
            const ListTag = node.ordered ? "ol" : "ul";
            return (
              <ListTag key={i}>
                {node.items?.map((item, j) => (
                  <li key={j}>{renderInline(item.content || "")}</li>
                ))}
              </ListTag>
            );
          }
          case "code":
            return (
              <pre
                key={i}
                style={{
                  background: "var(--bg-elevated, #f5f4f0)",
                  border: "1px solid var(--border-subtle, #A8A7B6)",
                  borderRadius: "8px",
                  padding: "16px 20px",
                  overflowX: "auto",
                  fontSize: "0.875rem",
                  lineHeight: 1.7,
                  margin: "24px 0",
                }}
              >
                <code style={{ fontFamily: "monospace" }}>
                  {node.content}
                </code>
              </pre>
            );
          case "table":
            return (
              <div key={i} style={{ overflowX: "auto", margin: "24px 0" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.875rem",
                  }}
                >
                  {node.headers && (
                    <thead>
                      <tr>
                        {node.headers.map((h, j) => (
                          <th
                            key={j}
                            style={{
                              textAlign: "left",
                              padding: "10px 12px",
                              borderBottom: "2px solid var(--border-subtle, #A8A7B6)",
                              fontWeight: 600,
                              color: "var(--text-primary)",
                            }}
                          >
                            {renderInline(h)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {node.rows?.map((row, j) => (
                      <tr key={j}>
                        {row.map((cell, k) => (
                          <td
                            key={k}
                            style={{
                              padding: "10px 12px",
                              borderBottom: "1px solid var(--border-subtle, #A8A7B6)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "image":
            return (
              <figure key={i} style={{ margin: "32px 0" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={node.url}
                  alt={node.alt || ""}
                  style={{
                    maxWidth: "100%",
                    borderRadius: "8px",
                    border: "1px solid var(--border-subtle, #A8A7B6)",
                  }}
                />
                {node.alt && (
                  <figcaption
                    style={{
                      textAlign: "center",
                      fontSize: "0.8rem",
                      color: "var(--text-tertiary)",
                      marginTop: "8px",
                    }}
                  >
                    {node.alt}
                  </figcaption>
                )}
              </figure>
            );
          case "hr":
            return (
              <hr
                key={i}
                style={{
                  border: "none",
                  borderTop: "1px solid var(--border-subtle, #A8A7B6)",
                  margin: "32px 0",
                }}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
