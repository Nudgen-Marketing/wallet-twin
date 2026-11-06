/** One run of chat text, bold or plain. */
export interface TextSegment {
  text: string;
  bold: boolean;
}

/** `**bold**` on a single line; the reply model uses it for labels in its bullet lists. */
const BOLD_SPAN = /\*\*([^*\n]+)\*\*/g;

/**
 * Splits a twin reply into plain and bold runs so the chat can render `**…**` as <strong>
 * without injecting HTML. Unclosed markers (a reply still streaming) stay literal.
 */
export function splitBold(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(BOLD_SPAN)) {
    const start = match.index;
    if (start > cursor) segments.push({ text: text.slice(cursor, start), bold: false });
    segments.push({ text: match[1], bold: true });
    cursor = start + match[0].length;
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor), bold: false });
  return segments;
}
