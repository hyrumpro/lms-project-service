import sanitize from "sanitize-html";

/**
 * Sanitizes rich HTML content to prevent stored XSS attacks
 * across lessons, blog posts, custom pages, and homepage sections.
 *
 * Uses sanitize-html (pure JS, no DOM) — jsdom-based sanitizers crash on
 * Vercel's serverless runtime (ESM-only transitive deps).
 */
const OPTIONS: sanitize.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "p", "a", "ul", "ol",
    "nl", "li", "b", "i", "strong", "em", "strike", "code", "hr", "br", "div",
    "table", "thead", "caption", "tbody", "tr", "th", "td", "pre", "span",
    "img", "figure", "figcaption",
  ],
  allowedAttributes: {
    "*": ["href", "name", "target", "src", "alt", "title", "class", "style", "width", "height"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel", "callto", "sms", "cid", "xmpp"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
};

export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return "";
  return sanitize(dirty, OPTIONS);
}
