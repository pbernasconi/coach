// A small Markdown reader for clinician notes: headings (#, ##, ###), "- " lists, paragraphs and **bold**. It
// returns plain data (no HTML), so the page renders it as React text and nothing in a note can run as markup.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Decodes the HTML entities Function leaves in its text (&#39;, &amp;, &#x27; …). */
export function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** "**a** b" → [{ text: 'a', bold: true }, { text: ' b', bold: false }] */
export function inline(s) {
  const out = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (let m; (m = re.exec(s)); last = re.lastIndex) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), bold: false });
    out.push({ text: m[1], bold: true });
  }
  if (last < s.length) out.push({ text: s.slice(last), bold: false });
  return out;
}

/**
 * Blocks: { type: 'heading', level, spans } | { type: 'list', items: spans[] } | { type: 'paragraph', spans }.
 * @param {string} text
 */
export function parseNote(text) {
  const blocks = [];
  let para = [];
  let list = null;
  const flush = () => {
    if (para.length) blocks.push({ type: 'paragraph', spans: inline(para.join(' ')) });
    para = [];
    if (list) blocks.push(list);
    list = null;
  };
  for (const raw of decodeEntities(text).split(/\r?\n/)) {
    const line = raw.trim();
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    const li = /^[-*•]\s+(.*)$/.exec(line);
    if (!line) flush();
    else if (h) { flush(); blocks.push({ type: 'heading', level: h[1].length, spans: inline(h[2]) }); }
    else if (li) {
      if (para.length) { blocks.push({ type: 'paragraph', spans: inline(para.join(' ')) }); para = []; }
      (list ??= { type: 'list', items: [] }).items.push(inline(li[1]));
    } else { if (list) { blocks.push(list); list = null; } para.push(line); }
  }
  flush();
  return blocks;
}
