// Where the sentences a Check lists are in the text that was checked, for the editor's highlights. Compared the way
// the API and the other p3n clients compare text: curly quotes as straight, whitespace runs as one space, any case,
// punctuation at either end left out. No vscode here, so the unit tests run in Node.
const { listed } = require('./present');

const QUOTES = { '‘': "'", '’': "'", '‚': "'", '‛': "'", '“': '"', '”': '"', '„': '"', '‟': '"' };

// The folded text, and for each of its characters the span of `text` it came from.
function fold(text) {
  let out = '';
  const at = [];
  let i = 0;
  for (const ch of text) {
    if (/\s/.test(ch)) {
      if (!out.endsWith(' ')) {
        out += ' ';
        at.push([i, i + ch.length]);
      }
    } else {
      const f = (QUOTES[ch] ?? ch).toLowerCase();
      out += f;
      for (let k = 0; k < f.length; k++) at.push([i, i + ch.length]);
    }
    i += ch.length;
  }
  return { out, at };
}

// The listed sentences found in `text`, as offsets into it: [{ kind: 'sentence' | 'hit', start, end, why }]. A
// sentence listed twice goes to its next occurrence; one that isn't found is left out (the view still lists it).
function marks(text, output) {
  const hay = fold(String(text ?? ''));
  const next = new Map(); // a sentence's folded core → where its next occurrence may start
  const found = [];
  const { sentences, hits } = listed(output ?? {});
  for (const [kind, items] of [['sentence', sentences], ['hit', hits]]) {
    for (const { text: sentence, why } of items) {
      const [, head, core, tail] = fold(String(sentence ?? '')).out.match(/^([\s\p{P}]*)(.*?)([\s\p{P}]*)$/su);
      if (!core) continue;
      const i = hay.out.indexOf(core, next.get(core) ?? 0);
      if (i < 0) continue;
      next.set(core, i + core.length);
      // The sentence's own punctuation at either end, where the text has it too.
      const h = head.replace(/\s/g, '');
      const t = tail.replace(/\s/g, '');
      const a = h && i >= h.length && hay.out.slice(i - h.length, i) === h ? i - h.length : i;
      const b = t && hay.out.startsWith(t, i + core.length) ? i + core.length + t.length : i + core.length;
      found.push({ kind, start: hay.at[a][0], end: hay.at[b - 1][1], why: why || null });
    }
  }
  return found;
}

module.exports = { marks };
