// What the p3n view says: the score, the sentences, the rewrite, the errors. The wording is the browser
// extension's and the Word add-in's, so every p3n client reads the same. No vscode here, so the unit tests run in Node.
const { LINKS, SITE, MAX_CHARS, MIN_DETECT_CHARS, ApiError } = require('./api');

const pct = (x) => Math.round((x || 0) * 100);
const tone = (x) => (x >= 0.7 ? 'ai' : x >= 0.4 ? 'mid' : 'human');
const LABELS = { human: 'Likely human-written', ai: 'Likely AI-written', ai_edited: 'AI-written, then edited', humanized: 'AI-written, then humanized', mixed: 'Mixed: part human, part AI' };
const words = (t) => (t || '').trim().split(/\s+/).filter(Boolean).length;
const clip = (t, n = 220) => (t && t.length > n ? t.slice(0, n - 1) + '…' : t);
const norm = (t) => (t || '').replace(/\s+/g, ' ').trim();
const limit = (hasKey) => (hasKey ? MAX_CHARS.key : MAX_CHARS.free);

// The selection before it's sent: an ApiError to show instead of calling, or null.
function precheck(skill, text, hasKey) {
  if (text.length > limit(hasKey)) {
    return new ApiError(422, 'too_long', hasKey
      ? `That's ${text.length.toLocaleString('en-US')} characters; the API takes up to ${MAX_CHARS.key.toLocaleString('en-US')}. Select less.`
      : `That's ${text.length.toLocaleString('en-US')} characters. Without an API key p3n takes up to ${MAX_CHARS.free.toLocaleString('en-US')}. Select less, or add a key.`);
  }
  if (skill === 'detect' && [...text].length < MIN_DETECT_CHARS) {
    return new ApiError(422, 'too_short', `Check needs at least ${MIN_DETECT_CHARS} characters, a sentence or two. Select more.`);
  }
  return null;
}

// Without the fields this version reads, say so: don't show 0% or a script error.
function badOutput(run, skill = run?.skill) {
  const o = run?.output;
  if ((skill === 'detect' && typeof o?.ai !== 'number')
    || (skill === 'humanize' && (typeof o?.text !== 'string' || typeof o?.ai_after !== 'number'))) {
    return new ApiError(502, 'bad_output', 'p3n answered without a result. Try again. If it keeps happening, update the extension.');
  }
  return null;
}

// The small line under a result: the skill version, the cache, the price with a key.
function meta(run, hasKey) {
  return `${run.output?.version ?? run.skill}${run.cached ? ' · from cache' : ''}${hasKey && Number(run.charged_usd) ? ` · $${Number(run.charged_usd).toFixed(4)}` : ''}`;
}

function detect(o) {
  const shownSentences = (o.sentences ?? []).slice(0, 5);
  // A pattern hit is listed only if its sentence isn't already among the sentences.
  const shown = new Set(shownSentences.map((s) => norm(s.text)));
  return {
    kind: 'detect',
    score: { label: LABELS[o.label] ?? 'Unknown', from: 0, to: pct(o.ai), tone: tone(o.ai), unit: 'likely AI' },
    verdict: o.verdict || null,
    confidence: o.confidence?.level ? `Confidence ${o.confidence.level}: ${o.confidence.reason ?? ''}` : null,
    sentences: shownSentences.map((s) => ({ why: s.why || null, text: clip(s.text) })),
    hits: (o.examples ?? []).filter((e) => !shown.has(norm(e.sentence))).slice(0, 6).map((e) => ({
      why: (e.rules ?? []).map((r) => String(r.name ?? '').replace(/\s*\(LLM\)$/, '')).join(' · '),
      text: clip(e.sentence),
    })),
    foot: 'A score is a probability, not proof. Read the sentences yourself before deciding anything about a person.',
  };
}

// `selected` is the selection as it was in the editor; `sent` the trimmed text that went to p3n.
function humanize(o, sent, selected) {
  // The rewrite ends with a line break; keep only the whitespace the selection itself had at each end, so
  // Replace doesn't join it to the line or word before or after.
  const insert = selected.match(/^\s*/)[0] + o.text.trim() + selected.match(/\s*$/)[0];
  // "No longer" and "Still" only when the detector model put the text sent in the AI class: it can score
  // text at 0% that Check called likely AI, and "No longer reads as AI, 0% → 2%" reads wrong.
  const before = o.ai_before != null ? pct(o.ai_before) : pct(o.ai_after);
  const wasAI = o.ai_before != null && o.ai_before >= 0.5;
  const notes = [];
  if (words(o.text) / Math.max(1, words(sent)) < 0.6) {
    notes.push({ kind: 'warn', text: `Kept ${words(o.text)} of ${words(sent)} words. Most of this text was general statements with no facts in them, and those are what reads as AI. Add the specifics you meant (who, what, numbers) and run it again.` });
  }
  if (o.invented_blocked?.length) {
    notes.push({ kind: 'muted', text: `Kept as sent where a rewrite added ${o.invented_blocked.join(', ')}, which the text does not have.` });
  }
  return {
    kind: 'humanize',
    score: {
      label: o.passes ? (wasAI ? 'No longer reads as AI' : "Doesn't read as AI") : (wasAI ? 'Still reads as AI' : 'Reads as AI'),
      sub: `Detector model: ${LABELS[o.label_after] ?? 'unknown'}`,
      from: before, to: pct(o.ai_after), tone: tone(o.ai_after), showFrom: o.ai_before != null,
      unit: 'AI class', title: 'Detector model, AI class',
    },
    rewrite: insert.trim(),
    insert,
    notes,
    foot: 'Humanize drops filler and general statements that carry no fact. Check that every claim you need is still there.',
  };
}

// An error as the view shows it: lines of text and the buttons that help.
function error(e) {
  switch (e.type) {
    case 'free_limit': {
      const mins = e.retryAfter ? Math.max(1, Math.ceil(e.retryAfter / 60)) : null;
      // The link comes from the API's answer: follow it only to p3n's own site.
      const signup = e.signupUrl?.startsWith(`${SITE}/`) ? e.signupUrl : LINKS.signup;
      return { kind: 'error', lines: [
        { text: `The free checks for this hour are used up${mins ? `; more in about ${mins} min` : ''}.` },
        { text: 'Sign up for free credit and an API key, then add the key here to keep going.', small: true },
      ], actions: [{ label: 'Sign up', open: signup, primary: true }, { label: 'Add an API key', command: 'p3n.setKey' }] };
    }
    case 'insufficient_credit':
      return { kind: 'error', lines: [{ text: 'Your p3n balance is too low for this.' }], actions: [{ label: 'Top up', open: LINKS.billing, primary: true }] };
    case 'unauthorized':
      return { kind: 'error', lines: [{ text: "p3n didn't accept your API key. It may have been revoked." }], actions: [{ label: 'Change the key', command: 'p3n.setKey' }] };
    case 'rate_limited':
      return { kind: 'error', lines: [{ text: 'Too many requests at once. Wait a minute and try again.' }], actions: [] };
    default:
      return { kind: 'error', lines: [{ text: e.message || 'Something went wrong.' }], actions: [] };
  }
}

// The footer: the free calls left, or the key's balance.
function quota({ hasKey, free, account }) {
  if (!hasKey) {
    return free != null
      ? `${free} free ${free === 1 ? 'call' : 'calls'} left this hour without a key.`
      : 'Free without a key: 10 calls an hour, up to 5,000 characters each.';
  }
  if (account?.error === 'unauthorized') return "Your API key wasn't accepted. Change it with p3n: Set API key.";
  if (!account?.me) return '';
  return `Balance $${Number(account.me.balance_usd).toFixed(2)} · key ${account.me.key?.name ?? account.me.key?.prefix ?? ''}`;
}

// Where the selection is: "notes.md, line 4" or "notes.md, lines 4–9".
function where(fileName, startLine, endLine) {
  const lines = startLine === endLine ? `line ${startLine + 1}` : `lines ${startLine + 1}–${endLine + 1}`;
  return `${fileName}, ${lines}`;
}

// The view opens links only to p3n's own site.
const isP3nUrl = (url) => typeof url === 'string' && (url === SITE || url.startsWith(`${SITE}/`));

const undoKey = (platform = process.platform) => (platform === 'darwin' ? 'Cmd+Z' : 'Ctrl+Z');
const REPLACED = (platform) => `Replaced in the editor and selected there. ${undoKey(platform)} in the editor undoes it.`;
const REFUSED = {
  changed: 'The text in the editor changed since you selected it.',
  gone: 'That file is closed.',
  readonly: "That file can't be edited.",
  replaced: 'p3n already replaced that selection.',
};
const refused = (reason) => `${REFUSED[reason] ?? "p3n couldn't put the text back."} Copy the rewrite and paste it instead.`;

module.exports = { pct, tone, LABELS, precheck, badOutput, meta, detect, humanize, error, quota, where, isP3nUrl, undoKey, REPLACED, refused };
