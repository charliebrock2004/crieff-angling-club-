/**
 * A deliberately small Markdown renderer for admin-edited content.
 * Supports: ## / ### headings, paragraphs, - and 1. lists, > quotes,
 * **bold**, *italic*, [links](https://…). Output is React elements only —
 * no raw HTML is ever injected, so content cannot introduce scripts.
 */
import Link from "next/link";
import type { ReactNode } from "react";

function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^(https?:|mailto:|tel:)/i.test(h)) return h;
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  if (h.startsWith("#")) return h;
  return null;
}

export function renderInline(text: string, keyPrefix = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyPrefix}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("[")) {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!;
      const href = safeHref(lm[2]);
      if (!href) out.push(lm[1]);
      else if (href.startsWith("/")) out.push(<Link key={k} href={href}>{lm[1]}</Link>);
      else out.push(<a key={k} href={href} rel="noopener noreferrer" target={href.startsWith("http") ? "_blank" : undefined}>{lm[1]}</a>);
    } else out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className }: { source: string | null | undefined; className?: string }) {
  if (!source) return null;
  const blocks: ReactNode[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = line.match(/^(#{2,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const content = renderInline(h[2], `h${key}`);
      blocks.push(level === 2 ? <h2 key={key++}>{content}</h2> : level === 3 ? <h3 key={key++}>{content}</h3> : <h4 key={key++}>{content}</h4>);
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      blocks.push(<ul key={key++}>{items.map((t, j) => <li key={j}>{renderInline(t, `u${key}-${j}`)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      blocks.push(<ol key={key++}>{items.map((t, j) => <li key={j}>{renderInline(t, `o${key}-${j}`)}</li>)}</ol>);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={key++}>{renderInline(quote.join(" "), `q${key}`)}</blockquote>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,4}\s|\s*[-*]\s+|\s*\d+[.)]\s+|>)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={key++}>{renderInline(para.join(" "), `p${key}`)}</p>);
  }
  return <div className={className ?? "prose-club"}>{blocks}</div>;
}

/** Plain text (for meta descriptions, emails). */
export function stripMarkdown(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*#>_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
