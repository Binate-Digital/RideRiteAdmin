/**
 * Tiny Markdown → HTML renderer for admin-edited legal pages (no dependency). Everything is
 * HTML-escaped first, so the source can never inject markup; only this subset becomes HTML:
 * # / ## / ### headings, > quotes, - / * and 1. lists, **bold**, _italic_ / *italic*,
 * `code`, [links](https://…, mailto:…, /path, #anchor) and blank-line paragraphs.
 * (A copy of the web app's src/lib/markdown.ts — keep them in step.)
 */

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (/^(https?:\/\/|mailto:)/i.test(href) || href.startsWith("/") || href.startsWith("#")) return href;
  return null;
}

function inline(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
  s = s.replace(/(^|[\s(])\*([^*]+)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
  // Links: the URL was escaped with the rest; unescape &amp; for the check only
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    const href = safeHref(url.replace(/&amp;/g, "&"));
    if (!href) return label;
    const external = /^https?:/i.test(href);
    return `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
  });
  return s;
}

export function renderMarkdown(src: string): string {
  const lines = String(src || "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] = [];

  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.type}>`);
    list = null;
  };
  const flushQuote = () => {
    if (quote.length) out.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
    quote = [];
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushQuote();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const q = /^>\s?(.*)$/.exec(line);
    if (!line.trim()) {
      flushAll();
    } else if (h) {
      flushAll();
      const level = h[1].length + 1; // # → h2 (the page title is the h1)
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
    } else if (ul || ol) {
      flushPara();
      flushQuote();
      const type = ul ? "ul" : "ol";
      if (list && list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push((ul || ol)![1]);
    } else if (q) {
      flushPara();
      flushList();
      quote.push(q[1]);
    } else {
      flushList();
      flushQuote();
      para.push(line.trim());
    }
  }
  flushAll();
  return out.join("\n");
}
