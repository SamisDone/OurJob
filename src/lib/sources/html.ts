import { parseHTML } from "linkedom";

/**
 * Job descriptions arrive as HTML (Greenhouse entity-encodes it). Stored HTML
 * keeps only plain formatting tags and http(s) links, and text keeps the
 * paragraph and list breaks so the prefilter and P4 read it like the post.
 */

const KEEP = new Set([
  "p",
  "br",
  "ul",
  "ol",
  "li",
  "strong",
  "b",
  "em",
  "i",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "a",
  "blockquote",
  "code",
  "pre",
]);
const DROP = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "noscript",
  "template",
  "svg",
  "math",
  "form",
  "input",
  "button",
  "img",
  "video",
  "audio",
]);
const BLOCK = new Set([
  "p",
  "div",
  "li",
  "ul",
  "ol",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "pre",
  "section",
  "article",
  "tr",
  "table",
]);

const body = (html: string) => parseHTML(`<!doctype html><html><body>${html}</body></html>`).document.body;

/** Entity-encoded HTML ("&lt;p&gt;Hi&lt;/p&gt;", as Greenhouse sends it) to HTML; real HTML is left alone. */
export function decodeEntities(s: string): string {
  if (!/&lt;[a-z/]/i.test(s) || /<[a-z/]/i.test(s)) return s;
  return body(s).textContent ?? s;
}

export function sanitizeHtml(html: string): string {
  const root = body(html);
  const clean = (el: Element) => {
    for (const child of [...el.children]) {
      const tag = child.tagName.toLowerCase();
      if (DROP.has(tag)) {
        child.remove();
        continue;
      }
      clean(child);
      if (!KEEP.has(tag)) {
        // Unwrap: keep the text, drop the tag. Block tags become paragraphs.
        const replacement = BLOCK.has(tag) ? root.ownerDocument.createElement("p") : null;
        if (replacement) {
          while (child.firstChild) replacement.appendChild(child.firstChild);
          child.replaceWith(replacement);
        } else child.replaceWith(...child.childNodes);
        continue;
      }
      const href = tag === "a" ? child.getAttribute("href") : null;
      for (const attr of [...child.attributes]) child.removeAttribute(attr.name);
      if (tag === "a") {
        if (href && /^https?:\/\//i.test(href)) {
          child.setAttribute("href", href);
          child.setAttribute("rel", "noopener noreferrer nofollow");
          child.setAttribute("target", "_blank");
        }
      }
    }
  };
  clean(root);
  return root.innerHTML.replace(/<p>\s*<\/p>/g, "").trim();
}

export function htmlToText(html: string): string {
  const root = body(html);
  const out: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      out.push(node.textContent ?? "");
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = (node as Element).tagName.toLowerCase();
    if (DROP.has(tag)) return;
    if (tag === "br") out.push("\n");
    const block = BLOCK.has(tag);
    if (block) out.push("\n");
    if (tag === "li") out.push("- ");
    for (const child of node.childNodes) walk(child);
    if (block) out.push("\n");
  };
  walk(root);
  return out
    .join("")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
