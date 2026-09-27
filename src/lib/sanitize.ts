import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitizes rich HTML content to prevent stored XSS attacks
 * across lessons, blog posts, custom pages, and homepage sections.
 */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return "";
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "p", "a", "ul", "ol",
      "nl", "li", "b", "i", "strong", "em", "strike", "code", "hr", "br", "div",
      "table", "thead", "caption", "tbody", "tr", "th", "td", "pre", "span",
      "img", "figure", "figcaption"
    ],
    ALLOWED_ATTR: ["href", "name", "target", "src", "alt", "title", "class", "style", "width", "height"],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });
}
