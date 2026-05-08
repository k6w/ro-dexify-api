import sanitizeHtml from 'sanitize-html';

const PLAIN_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  allowedSchemes: [],
  textFilter: (text) => text,
};

export function htmlToPlainText(html: string): string {
  if (!html) return '';
  const decoded = sanitizeHtml(html, PLAIN_TEXT_OPTIONS);
  return decoded.replace(/\s+/g, ' ').trim();
}

export function safeText(input: string): string {
  return htmlToPlainText(input);
}
