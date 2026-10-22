// p3n in a real VS Code: the commands on an editor selection, the view's text, Replace and undo, the key in
// SecretStorage, the theme. The API is the stand-in in mock.js.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vscode = require('vscode');
const { mock, start } = require('./mock');
const { AI_TEXT, SHORT, FIXTURES } = require('../../fixtures');
const { version } = require('../../../package.json');

const EXT_ID = 'nikita-andreiev.p3n-vscode';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let p3n;
let doc;
let editor;
let original;

async function waitFor(fn, what, ms = 10_000) {
  const t0 = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error(`Timed out waiting for ${what}. The view shows:\n${p3n.lastRendered?.text}`);
    await sleep(40);
  }
}
// The view's text once it matches (the view posts its text after every draw).
const shows = (re, ms) => waitFor(() => re.test(p3n.lastRendered?.text ?? '') && p3n.lastRendered.text, `the view to show ${re}`, ms);

async function openEssay() {
  doc = await vscode.workspace.openTextDocument(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'essay.md'));
  editor = await vscode.window.showTextDocument(doc, { preview: false });
  original = doc.getText();
}
function select(text, { from = 0, before = 0, after = 0 } = {}) {
  const i = doc.getText().indexOf(text, from);
  assert.ok(i >= 0, `"${text.slice(0, 30)}…" is in the document`);
  editor.selection = new vscode.Selection(doc.positionAt(i - before), doc.positionAt(i + text.length + after));
  return editor.selection;
}
async function check() {
  p3n.lastRendered = null;
  await vscode.commands.executeCommand('p3n.check');
}
async function rewrite() {
  p3n.lastRendered = null;
  await vscode.commands.executeCommand('p3n.rewrite');
}
async function restore() {
  // Undo everything a test did to the essay, so the next one starts from the file.
  if (doc.getText() !== original) {
    await editor.edit((eb) => eb.replace(new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)), original));
  }
}

suiteSetup(async () => {
  await start(Number(process.env.P3N_MOCK_PORT));
  const ext = vscode.extensions.getExtension(EXT_ID);
  assert.ok(ext, `${EXT_ID} is installed`);
  ({ p3n } = await ext.activate());
  await openEssay();
  // Open the view once, so a test run alone (ONLY=) finds it drawn.
  await vscode.commands.executeCommand('p3n.view.focus');
  await waitFor(() => p3n.lastRendered, 'the view to draw');
  assert.match(p3n.lastRendered.text, /Free without a key: 10 calls an hour, up to 5,000 characters each\./);
});
suiteTeardown(() => mock.server?.close());
setup(async () => {
  mock.reset();
  if (vscode.window.activeTextEditor?.document !== doc) editor = await vscode.window.showTextDocument(doc, { preview: false });
  else editor = vscode.window.activeTextEditor;
});

suite('p3n', () => {
  test('commands, menus and the view are contributed', async () => {
    const all = await vscode.commands.getCommands(true);
    for (const c of ['p3n.check', 'p3n.rewrite', 'p3n.setKey', 'p3n.removeKey']) assert.ok(all.includes(c), c);
    const { contributes } = vscode.extensions.getExtension(EXT_ID).packageJSON;
    assert.deepEqual(contributes.commands.map((c) => c.title), ['p3n: Check for AI', 'p3n: Rewrite', 'p3n: Set API key', 'p3n: Remove API key']);
    assert.deepEqual(contributes.menus['editor/context'].map((m) => [m.command, m.when]), [['p3n.check', 'editorHasSelection'], ['p3n.rewrite', 'editorHasSelection']]);
    assert.equal(contributes.views.p3n[0].type, 'webview');
  });

  test('Check for AI: score, reason, sentences in the view; text and client header sent', async () => {
    select(AI_TEXT);
    await check();
    const text = await shows(/Likely AI-written/);
    for (const want of ['96%', 'likely AI', 'Generic filler phrases', 'Confidence medium: Two short sentences.', 'Sentences that read as AI', 'A stock opening with a vague claim.',
      'Pattern hits', 'Filler verb · Abstract benefit', 'A score is a probability, not proof.', 'detect-v1.2', 'essay.md, line 3 · 230 characters', '9 free calls left this hour without a key.']) {
      assert.ok(text.includes(want), `view shows "${want}":\n${text}`);
    }
    const [req] = mock.calls();
    assert.equal(mock.calls().length, 1);
    assert.equal(req.method, 'POST');
    assert.equal(req.path, '/v1/detect');
    assert.equal(req.headers['x-p3n-client'], `p3n-vscode/${version}`);
    assert.equal(req.headers.authorization, undefined);
    assert.deepEqual(req.body, { text: AI_TEXT });
  });

  test('Rewrite, then Replace selection: one undo step brings the text back', async () => {
    select(SHORT);
    await rewrite();
    const text = await shows(/No longer reads as AI/);
    for (const want of ['95% → ', '1%', 'AI class', 'Detector model: Likely human-written', 'This transition helps teams of all sizes.', 'Replace selection', 'Copy', 'Try another rewrite', 'humanize-v1.3']) {
      assert.ok(text.includes(want), `view shows "${want}":\n${text}`);
    }
    assert.ok(!text.includes('This transition helps teams of all sizes.\n\n\n'), 'no trailing line break from the API');
    await p3n.onMessage({ type: 'replace' });
    await shows(/Replaced in the editor and selected there\. (Ctrl|Cmd)\+Z in the editor undoes it\./);
    const want = original.replace(SHORT, 'This transition helps teams of all sizes.');
    assert.equal(doc.getText(), want);
    const active = vscode.window.activeTextEditor;
    assert.equal(active?.document, doc, 'the editor has focus again');
    assert.equal(doc.getText(active.selection), 'This transition helps teams of all sizes.', 'the rewrite is selected');
    await vscode.commands.executeCommand('undo');
    assert.equal(doc.getText(), original, 'one undo restores the selection');
    // A second Replace of the same result is refused: that selection is gone.
    await p3n.onMessage({ type: 'replace' });
    await shows(/p3n already replaced that selection\. Copy the rewrite and paste it instead\./);
    assert.equal(doc.getText(), original);
  });

  test('Replace keeps the whitespace the selection had at each end', async () => {
    select(SHORT, { before: 2, after: 2 }); // the blank line before and after
    await rewrite();
    await shows(/No longer reads as AI/);
    await p3n.onMessage({ type: 'replace' });
    await shows(/Replaced in the editor/);
    assert.equal(doc.getText(), original.replace(`\n\n${SHORT}\n\n`, '\n\nThis transition helps teams of all sizes.\n\n'));
    await vscode.commands.executeCommand('undo');
    assert.equal(doc.getText(), original);
  });

  test('Replace refuses when the text changed since the selection', async () => {
    const sel = select(SHORT);
    await rewrite();
    await shows(/No longer reads as AI/);
    await editor.edit((eb) => eb.insert(sel.start, 'Edited. '));
    await p3n.onMessage({ type: 'replace' });
    await shows(/The text in the editor changed since you selected it\. Copy the rewrite and paste it instead\./);
    assert.ok(doc.getText().includes(`Edited. ${SHORT}`));
    assert.ok(!doc.getText().includes('This transition helps'));
    await restore();
  });

  test('Replace in a file with Windows line ends, from another editor', async () => {
    const crlf = await vscode.workspace.openTextDocument({ language: 'plaintext', content: `Intro.\r\n${SHORT}\r\nMore of it, over two lines.\r\nEnd.\r\n` });
    const ed = await vscode.window.showTextDocument(crlf, { preview: false });
    assert.equal(crlf.eol, vscode.EndOfLine.CRLF);
    const i = crlf.getText().indexOf(SHORT);
    const end = crlf.getText().indexOf('End.');
    ed.selection = new vscode.Selection(crlf.positionAt(i), crlf.positionAt(end - 2));
    mock.queue.push({ body: { ...FIXTURES.humanize, output: { ...FIXTURES.humanize.output, text: 'Line one.\nLine two.\n' } } });
    await rewrite();
    await shows(/Line one\.\s+Line two\./);
    // The user moves to another file before clicking Replace.
    await vscode.window.showTextDocument(doc, { preview: false });
    await p3n.onMessage({ type: 'replace' });
    await shows(/Replaced in the editor/);
    assert.equal(crlf.getText(), 'Intro.\r\nLine one.\r\nLine two.\r\nEnd.\r\n');
    const active = vscode.window.activeTextEditor;
    assert.equal(active.document, crlf);
    assert.equal(crlf.getText(active.selection), 'Line one.\r\nLine two.');
    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
  });

  test('Show changes: the selection and the rewrite in the diff editor; Replace still works after', async () => {
    select(SHORT);
    await rewrite();
    assert.ok((await shows(/No longer reads as AI/)).includes('Show changes'));
    await p3n.onMessage({ type: 'compare' });
    const tab = await waitFor(() => {
      const t = vscode.window.tabGroups.activeTabGroup.activeTab;
      return t?.input instanceof vscode.TabInputTextDiff && t;
    }, 'the diff editor');
    assert.equal(tab.label, 'essay.md, line 5 ↔ Rewrite');
    const { original: left, modified: right } = tab.input;
    assert.deepEqual([left.scheme, right.scheme], ['p3n', 'p3n']);
    const [before, after] = await Promise.all([vscode.workspace.openTextDocument(left), vscode.workspace.openTextDocument(right)]);
    assert.equal(before.getText(), SHORT);
    assert.equal(after.getText(), 'This transition helps teams of all sizes.');
    assert.equal(after.languageId, 'markdown', 'highlighted like the file');
    assert.equal(doc.getText(), original, 'the file is untouched');
    // Replace from the view goes to the file, not the diff.
    await p3n.onMessage({ type: 'replace' });
    await shows(/Replaced in the editor/);
    assert.equal(vscode.window.activeTextEditor?.document, doc);
    assert.equal(doc.getText(), original.replace(SHORT, 'This transition helps teams of all sizes.'));
    await vscode.commands.executeCommand('undo');
    assert.equal(doc.getText(), original);
    const diffs = vscode.window.tabGroups.all.flatMap((g) => g.tabs).filter((t) => t.input instanceof vscode.TabInputTextDiff);
    await vscode.window.tabGroups.close(diffs);
  });

  test('Try another rewrite sends the same text with fresh: true', async () => {
    select(SHORT);
    await rewrite();
    await shows(/No longer reads as AI/);
    p3n.lastRendered = null;
    await p3n.onMessage({ type: 'again' });
    await shows(/No longer reads as AI/);
    assert.deepEqual(mock.calls().map((r) => r.body), [{ text: SHORT }, { text: SHORT, options: { fresh: true } }]);
  });

  test('Nothing selected, too long, too short: nothing is sent until the selection is enough', async () => {
    editor.selection = new vscode.Selection(0, 0, 0, 0);
    await check();
    await sleep(300);
    assert.equal(mock.calls().length, 0);

    const long = await vscode.workspace.openTextDocument({ content: 'x'.repeat(5001) });
    const ed = await vscode.window.showTextDocument(long, { preview: false });
    ed.selection = new vscode.Selection(0, 0, 0, 5001);
    await check();
    await shows(/That's 5,001 characters\. Without an API key p3n takes up to 5,000\. Select less, or add a key\.\s+Add an API key/);
    assert.deepEqual(p3n.result.actions, [{ label: 'Add an API key', command: 'p3n.setKey' }]);
    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');

    editor = await vscode.window.showTextDocument(doc, { preview: false });
    select('Team update');
    await check();
    await shows(/Check needs at least 40 characters, a sentence or two\. Select more\./);
    await rewrite();
    await shows(/Rewrite needs at least a sentence of eight words\. Select more\./);
    // Eight words are enough.
    select('We shipped the new billing page on Tuesday.');
    assert.equal(mock.calls().length, 0);
    await rewrite();
    await shows(/No longer reads as AI/);
    assert.deepEqual(mock.calls().map((r) => r.body), [{ text: 'We shipped the new billing page on Tuesday.' }]);
  });

  test('Errors read like the other p3n clients, with no script error', async () => {
    const cases = [
      [{ status: 429, body: { error: { type: 'free_limit', message: 'Free calls are used up.', signup_url: 'javascript:alert(1)', retry_after_seconds: 600 } } },
        /The free calls for this hour are used up; more in about 10 min\.[\s\S]*Sign up[\s\S]*Add an API key/],
      [{ status: 502, html: '<!doctype html><title>502</title>Bad gateway' }, /p3n answered 502\./],
      [{ body: { ...FIXTURES.detect, status: 'failed', output: null, error: 'The model provider failed. You were not charged.' } }, /The model provider failed\. You were not charged\./],
      [{ body: { ...FIXTURES.detect, output: { version: 'detect-v9' } } }, /p3n answered without a result\./],
      [{ status: 402, body: { error: { type: 'insufficient_credit', message: 'x' } } }, /Your p3n balance is too low for this\.[\s\S]*Top up/],
      [{ status: 429, body: { error: { type: 'rate_limited', message: 'x' } } }, /Too many requests at once\./],
      [{ status: 401, body: { error: { type: 'unauthorized', message: 'Invalid API key.' } } }, /p3n didn't accept your API key\. It may have been revoked\.[\s\S]*Change the key/],
      [{ drop: true }, /Can't reach p3n\. Check your connection and try again\./],
    ];
    for (const [next, want] of cases) {
      mock.queue.push(next);
      select(AI_TEXT);
      await check();
      await shows(want);
    }
    // Sign up goes to p3n.si, never to the link the error carried.
    mock.queue.push(cases[0][0]);
    await check();
    await shows(/used up/);
    assert.equal(p3n.result.actions[0].open, 'https://p3n.si/register');
  });

  test('A long text is polled until it finishes', async () => {
    mock.queue.push({ status: 202, body: { id: 'run-1', status: 'queued' } }, { body: { ...FIXTURES.detect, id: 'run-1' } });
    select(AI_TEXT);
    await check();
    await shows(/Likely AI-written/, 15_000);
    assert.deepEqual(mock.calls().map((r) => r.path), ['/v1/detect', '/v1/runs/run-1']);
  });

  test('The busy line counts from the start after the view is hidden and shown again', async () => {
    mock.queue.push({ delayMs: 8000, body: FIXTURES.humanize });
    select(SHORT);
    p3n.lastRendered = null;
    const running = vscode.commands.executeCommand('p3n.rewrite');
    await shows(/Rewriting… 0 s/);
    await vscode.commands.executeCommand('workbench.view.explorer');
    await sleep(2500);
    p3n.lastRendered = null;
    await vscode.commands.executeCommand('p3n.view.focus');
    await sleep(500);
    p3n.post();
    await shows(/Rewriting… [2-7] s/);
    await p3n.onMessage({ type: 'cancel' });
    await running;
  });

  test('Cancel stops a run and shows no result', async () => {
    mock.queue.push({ delayMs: 4000, body: FIXTURES.humanize });
    select(SHORT);
    p3n.lastRendered = null;
    const running = vscode.commands.executeCommand('p3n.rewrite');
    await shows(/Rewriting… \d+ s/);
    await p3n.onMessage({ type: 'cancel' });
    await running;
    await sleep(200);
    assert.equal(p3n.busy, null);
    assert.equal(p3n.result, null);
    assert.ok(!/Rewriting…|No longer reads as AI/.test(p3n.lastRendered.text), p3n.lastRendered.text);
  });

  test('API key: checked before saving, kept in SecretStorage, sent as a bearer token, removable', async () => {
    // No connection: not saved.
    mock.queue.push({ drop: true });
    assert.equal(await vscode.commands.executeCommand('p3n.setKey', 'p3n_good'), false);
    assert.equal(mock.calls('/v1/me').length, 1);
    assert.equal(await vscode.commands.executeCommand('p3n.setKey', 'p3n_wrong'), false);
    assert.equal(await vscode.commands.executeCommand('p3n.setKey', 'not-a-key'), false);
    assert.equal(p3n.key, '');
    assert.equal(await vscode.commands.executeCommand('p3n.setKey', 'p3n_good'), true);
    await waitFor(() => p3n.key === 'p3n_good', 'the key to load from SecretStorage');
    p3n.lastRendered = null;
    p3n.post();
    await shows(/Balance \$4\.50 · key laptop/);
    assert.match(p3n.lastRendered.text, /API key/);

    mock.reset();
    select(AI_TEXT);
    await check();
    await shows(/Likely AI-written/);
    const sent = mock.calls('/v1/detect')[0];
    assert.equal(sent.headers.authorization, 'Bearer p3n_good');

    // Not in settings.json.
    const settings = path.join(process.env.P3N_TEST_PROFILE, 'User', 'settings.json');
    if (fs.existsSync(settings)) assert.ok(!fs.readFileSync(settings, 'utf8').includes('p3n_good'));
    const setting = vscode.workspace.getConfiguration().inspect('p3n');
    assert.ok(!setting?.globalValue && !setting?.workspaceValue && !setting?.defaultValue, 'no p3n setting holds it');

    await vscode.commands.executeCommand('p3n.removeKey');
    await waitFor(() => p3n.key === '', 'the key to be removed');
    mock.reset();
    await check();
    await shows(/Likely AI-written/);
    assert.equal(mock.calls('/v1/detect')[0].headers.authorization, undefined);
  });

  test('The view follows the editor theme, light and dark', async () => {
    const config = vscode.workspace.getConfiguration('workbench');
    try {
      for (const [theme, kind, accent] of [['Default Dark Modern', 'vscode-dark', 'rgb(224, 151, 116)'], ['Default Light Modern', 'vscode-light', 'rgb(194, 65, 12)']]) {
        await config.update('colorTheme', theme, vscode.ConfigurationTarget.Global);
        await sleep(600);
        p3n.lastRendered = null;
        p3n.post();
        await waitFor(() => p3n.lastRendered?.theme.includes(kind), `the view's body to be ${kind}`);
        assert.equal(p3n.lastRendered.accent, accent);
      }
    } finally {
      await config.update('colorTheme', undefined, vscode.ConfigurationTarget.Global);
    }
  });
});
