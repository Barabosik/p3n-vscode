// What the view says for each answer: the same wording as the browser extension and the Word add-in.
const test = require('node:test');
const assert = require('node:assert/strict');
const present = require('../../src/present');
const { ApiError } = require('../../src/api');
const { AI_TEXT, SHORT, FIXTURES, HEADLINES } = require('../fixtures');

test('Check: score, label, reason, sentences; a pattern hit only when its sentence is new', () => {
  const m = present.detect(FIXTURES.detect.output);
  assert.deepEqual(m.score, { label: 'Likely AI-written', from: 0, to: 96, tone: 'ai', unit: 'likely AI' });
  assert.equal(m.verdict, 'Generic filler phrases with no specific claim or example.');
  assert.equal(m.confidence, 'Confidence medium: Two short sentences.');
  assert.deepEqual(m.sentences, [{ why: 'A stock opening with a vague claim.', text: AI_TEXT.split('. ')[0] + '.' }]);
  assert.equal(m.hits.length, 1);
  assert.equal(m.hits[0].why, 'Filler verb · Abstract benefit');
  assert.match(m.foot, /probability, not proof/);
});

test('Check: bands, unknown labels, long sentences clipped', () => {
  assert.equal(present.detect({ ai: 0.5, label: 'mixed' }).score.tone, 'mid');
  assert.equal(present.detect({ ai: 0.1, label: 'human' }).score.label, 'Likely human-written');
  assert.equal(present.detect({ ai: 0.1, label: 'new_label' }).score.label, 'Unknown');
  const long = 'word '.repeat(80);
  const m = present.detect({ ai: 0.9, label: 'ai', sentences: [{ text: long }] });
  assert.equal(m.sentences[0].text.length, 220);
  assert.ok(m.sentences[0].text.endsWith('…'));
});

for (const [scores, want] of HEADLINES) {
  test(`Rewrite headline: ${want} (${scores.ai_before} → ${scores.ai_after})`, () => {
    const m = present.humanize({ ...FIXTURES.humanize.output, ...scores }, SHORT, SHORT);
    assert.equal(m.score.label, want);
    assert.equal(m.score.showFrom, scores.ai_before != null);
  });
}

test('Rewrite: detector-model wording, scores, the whitespace the selection had', () => {
  const m = present.humanize(FIXTURES.humanize.output, SHORT, `\n  ${SHORT}  \n`);
  assert.equal(m.score.sub, 'Detector model: Likely human-written');
  assert.equal(m.score.unit, 'AI class');
  assert.equal(m.score.from, 95);
  assert.equal(m.score.to, 1);
  assert.equal(m.rewrite, 'This transition helps teams of all sizes.');
  assert.equal(m.insert, '\n  This transition helps teams of all sizes.  \n');
  assert.match(m.foot, /Check that every claim you need is still there/);
});

test('Rewrite: a big cut and blocked inventions get a note', () => {
  const m = present.humanize({ ...FIXTURES.humanize.output, invented_blocked: ['a date', '40%'] }, SHORT, SHORT);
  assert.equal(m.notes[0].kind, 'warn');
  assert.match(m.notes[0].text, /^Kept 7 of 23 words\./);
  assert.equal(m.notes[1].text, 'Kept as sent where a rewrite added a date, 40%, which the text does not have.');
  assert.deepEqual(present.humanize({ ...FIXTURES.humanize.output, text: SHORT }, SHORT, SHORT).notes, []);
});

test('Before a call: too long without a key, with a key; too short for Check', () => {
  const free = present.precheck('detect', 'x'.repeat(5001), false);
  assert.equal(free.message, "That's 5,001 characters. Without an API key p3n takes up to 5,000. Select less, or add a key.");
  assert.equal(present.precheck('detect', 'x'.repeat(5001), true), null);
  assert.match(present.precheck('humanize', 'x'.repeat(200_001), true).message, /the API takes up to 200,000/);
  assert.equal(present.precheck('detect', 'Too short.', false).message, 'Check needs at least 40 characters, a sentence or two. Select more.');
  // Counted in code points: 39 emoji are 78 UTF-16 units but still too short.
  assert.equal(present.precheck('detect', '😀'.repeat(39), false).type, 'too_short');
  // Over the free limit: the error offers the key it mentions. With a key there's no key to add.
  assert.deepEqual(present.error(free).actions, [{ label: 'Add an API key', command: 'p3n.setKey' }]);
  assert.deepEqual(present.error(present.precheck('detect', 'x'.repeat(200_001), true)).actions, []);
});

test('Before a call: Rewrite needs eight words, counted like the API (numbers are not words)', () => {
  const MSG = 'Rewrite needs at least a sentence of eight words. Select more.';
  assert.equal(present.precheck('humanize', 'Too short to rewrite here.', false).message, MSG);
  assert.equal(present.precheck('humanize', 'Revenue rose 12% to 4.2M in Q3 2026.', false).type, 'too_short');
  assert.equal(present.precheck('humanize', 'We moved the office to Tivolska in March.', false), null);
  // Check isn't held to it: 40 characters are enough there.
  assert.equal(present.precheck('detect', 'Revenue rose 12% to 4.2M in Q3 2026, again.', false), null);
  // The longer limit is said first.
  assert.equal(present.precheck('humanize', 'x '.repeat(3000), false).type, 'too_long');
});

test('An answer without its fields is an error, not 0%', () => {
  assert.equal(present.badOutput({ skill: 'detect', output: { version: 'detect-v9' } }).type, 'bad_output');
  assert.equal(present.badOutput({ output: { version: 'humanize-v9', ai_after: 0.1 } }, 'humanize').type, 'bad_output');
  assert.equal(present.badOutput(FIXTURES.detect), null);
  assert.equal(present.badOutput(FIXTURES.humanize), null);
});

test('The small line: version, cache, price with a key', () => {
  assert.equal(present.meta(FIXTURES.detect, false), 'detect-v1.2');
  assert.equal(present.meta({ ...FIXTURES.detect, cached: true, charged_usd: '0.0021' }, true), 'detect-v1.2 · from cache · $0.0021');
  assert.equal(present.meta({ ...FIXTURES.detect, charged_usd: '0.0021' }, false), 'detect-v1.2');
});

test('Errors: own copy and buttons; Sign up only to p3n.si', () => {
  const limit = present.error(new ApiError(429, 'free_limit', 'x', { retryAfter: 600, signupUrl: 'https://evil.example/' }));
  assert.equal(limit.lines[0].text, 'The free calls for this hour are used up; more in about 10 min.');
  assert.deepEqual(limit.actions, [{ label: 'Sign up', open: 'https://p3n.si/register', primary: true }, { label: 'Add an API key', command: 'p3n.setKey' }]);
  assert.equal(present.error(new ApiError(429, 'free_limit', 'x', { signupUrl: 'https://p3n.si/register?x=1' })).actions[0].open, 'https://p3n.si/register?x=1');
  assert.equal(present.error(new ApiError(429, 'free_limit', 'x')).lines[0].text, 'The free calls for this hour are used up.');
  assert.deepEqual(present.error(new ApiError(402, 'insufficient_credit', 'x')).actions, [{ label: 'Top up', open: 'https://p3n.si/dashboard/billing', primary: true }]);
  assert.equal(present.error(new ApiError(401, 'unauthorized', 'x')).actions[0].command, 'p3n.setKey');
  assert.equal(present.error(new ApiError(429, 'rate_limited', 'x')).lines[0].text, 'Too many requests at once. Wait a minute and try again.');
  assert.equal(present.error(new ApiError(504, 'too_long', 'The text took longer than 85 s to process; send a shorter text. Not charged.')).lines[0].text, 'The text took longer than 85 s to process; send a shorter text. Not charged.');
});

test('Set API key: a refused key points at the keys page; a lost connection does not', () => {
  assert.deepEqual(present.keyError(new ApiError(401, 'unauthorized', 'Invalid API key.')),
    { text: "p3n doesn't accept this key, so it wasn't saved. Copy it again from the API keys page.", keysPage: true });
  assert.deepEqual(present.keyError(new ApiError(0, 'network', "Can't reach p3n. Check your connection and try again.")),
    { text: "p3n couldn't check the key, so it wasn't saved. Can't reach p3n. Check your connection and try again.", keysPage: false });
});

test('The footer: free calls left, or the balance', () => {
  assert.equal(present.quota({ hasKey: false, free: null }), 'Free without a key: 10 calls an hour, up to 5,000 characters each.');
  assert.equal(present.quota({ hasKey: false, free: 1 }), '1 free call left this hour without a key.');
  assert.equal(present.quota({ hasKey: false, free: 9 }), '9 free calls left this hour without a key.');
  assert.equal(present.quota({ hasKey: true, account: { me: FIXTURES.me } }), 'Balance $4.50 · key laptop');
  assert.equal(present.quota({ hasKey: true, account: { error: 'unauthorized' } }), "Your API key wasn't accepted. Change it with p3n: Set API key.");
  assert.equal(present.quota({ hasKey: true, account: null }), '');
});

test('The view opens links only to p3n.si', () => {
  assert.equal(present.isP3nUrl('https://p3n.si'), true);
  assert.equal(present.isP3nUrl('https://p3n.si/dashboard/keys'), true);
  assert.equal(present.isP3nUrl('https://p3n.si.evil.example/'), false);
  assert.equal(present.isP3nUrl('javascript:alert(1)'), false);
  assert.equal(present.isP3nUrl(undefined), false);
});

test('Where the selection is, and what Replace says', () => {
  assert.equal(present.where('notes.md', 3, 3), 'notes.md, line 4');
  assert.equal(present.where('notes.md', 3, 8), 'notes.md, lines 4–9');
  assert.equal(present.REPLACED('win32'), 'Replaced in the editor and selected there. Ctrl+Z in the editor undoes it.');
  assert.equal(present.REPLACED('darwin'), 'Replaced in the editor and selected there. Cmd+Z in the editor undoes it.');
  assert.equal(present.refused('changed'), 'The text in the editor changed since you selected it. Copy the rewrite and paste it instead.');
  assert.equal(present.refused('nope'), "p3n couldn't put the text back. Copy the rewrite and paste it instead.");
  assert.equal(present.compareTitle('notes.md, lines 4–9'), 'notes.md, lines 4–9 ↔ Rewrite');
});
