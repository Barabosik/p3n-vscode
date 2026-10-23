// Where the listed sentences are in the checked text, for the editor's highlights.
const test = require('node:test');
const assert = require('node:assert/strict');
const { marks } = require('../../src/marks');
const { AI_TEXT, FIXTURES } = require('../fixtures');

// What each mark covers, as text.
const covered = (text, found) => found.map((m) => [m.kind, text.slice(m.start, m.end)]);
const sentences = (...texts) => ({ sentences: texts.map((text) => ({ text, why: 'why' })) });

test('Check: the listed sentence and the new pattern hit, with their reasons', () => {
  const found = marks(AI_TEXT, FIXTURES.detect.output);
  const [first, second] = [AI_TEXT.split('. ')[0] + '.', AI_TEXT.split('. ')[1]];
  assert.deepEqual(found, [
    { kind: 'sentence', start: 0, end: first.length, why: 'A stock opening with a vague claim.' },
    { kind: 'hit', start: AI_TEXT.indexOf(second), end: AI_TEXT.length, why: 'Filler verb · Abstract benefit' },
  ]);
});

test('Curly quotes match straight ones, both ways', () => {
  const text = 'He said “it’s fine” and left. Then it rained.';
  assert.deepEqual(covered(text, marks(text, sentences('He said "it\'s fine" and left.'))), [['sentence', 'He said “it’s fine” and left.']]);
  const straight = 'He said "it\'s fine" and left.';
  assert.deepEqual(covered(straight, marks(straight, sentences('He said “it’s fine” and left.'))), [['sentence', straight]]);
});

test('Whitespace runs, line breaks and Windows line ends count as one space', () => {
  const text = 'Intro.\r\nThe team  shipped\r\nthe page\ton Tuesday. End.';
  assert.deepEqual(covered(text, marks(text, sentences('The team shipped the page on Tuesday.'))), [['sentence', 'The team  shipped\r\nthe page\ton Tuesday.']]);
  assert.deepEqual(covered(text, marks(text, sentences('  The team shipped\nthe page on Tuesday.  '))), [['sentence', 'The team  shipped\r\nthe page\ton Tuesday.']]);
});

test('Any case', () => {
  const text = 'Moreover, Leveraging The Right Tools helps.';
  assert.deepEqual(covered(text, marks(text, sentences('moreover, leveraging the right tools helps.'))), [['sentence', text]]);
});

test('Punctuation at either end is left out of the comparison, and marked where the text has it too', () => {
  const text = 'First one here. "Second one here!" Third.';
  assert.deepEqual(covered(text, marks(text, sentences('First one here'))), [['sentence', 'First one here']]);
  assert.deepEqual(covered(text, marks(text, sentences('First one here!'))), [['sentence', 'First one here']]);
  assert.deepEqual(covered(text, marks(text, sentences('Second one here!'))), [['sentence', 'Second one here!']]);
  assert.deepEqual(covered(text, marks(text, sentences('"Second one here!"'))), [['sentence', '"Second one here!"']]);
  assert.deepEqual(covered(text, marks(text, sentences('— Third —'))), [['sentence', 'Third']]);
});

test('A repeated sentence goes to its next occurrence; one more than the text has is skipped', () => {
  const text = 'It is what it is. Then more. It is what it is.';
  const found = marks(text, sentences('It is what it is.', 'it is what it is', 'It is what it is.'));
  assert.deepEqual(found.map((m) => [m.start, m.end]), [[0, 17], [29, 45]]);
  assert.equal(text.slice(29, 46), 'It is what it is.');
});

test("A sentence that isn't in the text is skipped; the others are still marked", () => {
  const text = 'One real sentence. Another real one.';
  assert.deepEqual(covered(text, marks(text, sentences('Not in the text at all.', 'Another real one.'))), [['sentence', 'Another real one.']]);
});

test('Only the checked text: a sentence outside it is not marked, and offsets count from its start', () => {
  const doc = 'Before the selection. Inside the selection, a sentence. After it.';
  const checked = doc.slice(doc.indexOf('Inside'), doc.indexOf(' After'));
  const found = marks(checked, sentences('Before the selection.', 'Inside the selection, a sentence.', 'After it.'));
  assert.deepEqual(found.map((m) => [m.start, m.end]), [[0, checked.length]]);
});

test('Only what the view lists: five sentences, and pattern hits not among them', () => {
  const texts = ['S one here.', 'S two here.', 'S three here.', 'S four here.', 'S five here.', 'S six here.'];
  const text = texts.join(' ');
  const output = { ...sentences(...texts), examples: [{ sentence: 'S one here.', rules: [{ name: 'Stock opener' }] }, { sentence: 'S six here.', rules: [{ name: 'Filler (LLM)' }] }] };
  assert.deepEqual(marks(text, output).map((m) => [m.kind, text.slice(m.start, m.end), m.why]), [
    ['sentence', 'S one here.', 'why'], ['sentence', 'S two here.', 'why'], ['sentence', 'S three here.', 'why'], ['sentence', 'S four here.', 'why'], ['sentence', 'S five here.', 'why'],
    ['hit', 'S six here.', 'Filler'],
  ]);
});

test('Nothing to mark: no text, no sentences, empty or punctuation-only sentences', () => {
  assert.deepEqual(marks('', FIXTURES.detect.output), []);
  assert.deepEqual(marks(AI_TEXT, {}), []);
  assert.deepEqual(marks(AI_TEXT, undefined), []);
  assert.deepEqual(marks(AI_TEXT, { sentences: [{ text: '' }, { text: ' ... ' }, {}] }), []);
});
