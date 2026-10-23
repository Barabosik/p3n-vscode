// The extension's state and actions: take the editor's selection, call p3n, keep the result for the view,
// put a rewrite back. The view (view.js) only draws what state() returns and sends clicks back here.
const vscode = require('vscode');
const api = require('./api');
const present = require('./present');
const { marks } = require('./marks');
const { Highlights } = require('./highlights');

const SECRET = 'p3n.apiKey';
const VIEW_ID = 'p3n.view';
// Show changes' two documents: in memory, read-only, never on disk.
const DIFF_SCHEME = 'p3n';
// Buttons in the view may run only these commands.
const VIEW_COMMANDS = new Set(['p3n.setKey']);

class P3n {
  constructor(context, view) {
    this.context = context;
    this.view = view;
    this.key = '';
    this.free = null; // free calls left this hour (X-Free-Remaining), after the first call
    this.account = null; // { me } or { error }, with a key
    this.busy = null; // { skill, since }: since is when it started, so the view counts on after it's hidden and shown
    this.source = null; // the selection the result is about
    this.result = null; // a view model from present.js
    this.seq = 0; // a new result's number, so the view animates it once
    this.controller = null;
    this.compared = new Map(); // Show changes' documents: uri → text
    this.lastEditor = vscode.window.activeTextEditor;
    this.test = context.extensionMode === vscode.ExtensionMode.Test;
    this.rendered = new vscode.EventEmitter(); // the view's text after each draw (tests only)
    this.highlights = new Highlights(() => this.highlightsChanged());
    view.onMessage = (m) => this.onMessage(m);
  }

  async init() {
    this.key = (await this.context.secrets.get(SECRET)) || '';
    this.keyChanged();
    this.context.subscriptions.push(
      this.rendered,
      this.highlights,
      // Another window saved or removed the key.
      this.context.secrets.onDidChange(async (e) => {
        if (e.key !== SECRET) return;
        this.key = (await this.context.secrets.get(SECRET)) || '';
        this.keyChanged();
      }),
      // A click in the view moves focus off the editor; remember the last one for the view's buttons.
      vscode.window.onDidChangeActiveTextEditor((ed) => { if (ed) this.lastEditor = ed; }),
    );
  }

  keyChanged() {
    vscode.commands.executeCommand('setContext', 'p3n.hasKey', !!this.key);
    this.account = null;
    this.post();
    this.refreshAccount();
  }

  state() {
    return {
      hasKey: !!this.key,
      quota: present.quota({ hasKey: !!this.key, free: this.free, account: this.account }),
      busy: this.busy,
      source: this.source && { where: this.source.where, chars: this.source.sent.length },
      result: this.result,
      seq: this.seq,
      test: this.test,
    };
  }

  post() { this.view.post(this.state()); }

  // The view's Clear highlights button and the palette's command show only while there are highlights.
  highlightsChanged() {
    const on = !!this.highlights.current;
    vscode.commands.executeCommand('setContext', 'p3n.hasHighlights', on);
    if (this.result?.kind === 'detect') this.result.marked = on;
    this.post();
  }

  show(model) {
    this.result = model;
    this.seq++;
    this.post();
  }

  editor() {
    const ed = vscode.window.activeTextEditor;
    if (ed) return ed;
    return this.lastEditor && !this.lastEditor.document.isClosed ? this.lastEditor : undefined;
  }

  // Check for AI or Rewrite on the editor's selection; `again` rewrites the last text once more.
  async run(skill, { again = false, options } = {}) {
    let src = again ? this.source : null;
    if (!src) {
      const ed = this.editor();
      if (!ed) return void vscode.window.showInformationMessage('Open a file and select some text first.');
      const sel = ed.selection;
      const selected = ed.document.getText(sel);
      if (!selected.trim()) return void vscode.window.showInformationMessage('Nothing is selected. Select some text in the editor first.');
      // A selection that ends at the start of a line doesn't take that line.
      const endLine = sel.end.character === 0 && sel.end.line > sel.start.line ? sel.end.line - 1 : sel.end.line;
      const name = ed.document.uri.path.split('/').pop() || 'Untitled';
      src = {
        uri: ed.document.uri,
        version: ed.document.version,
        range: new vscode.Range(sel.start, sel.end),
        selected,
        sent: selected.trim(),
        name,
        where: present.where(name, sel.start.line, endLine),
        viewColumn: ed.viewColumn,
        replaced: false,
      };
    }
    this.controller?.abort();
    this.controller = null;
    this.source = src;
    this.result = null;
    this.busy = null;
    this.highlights.clear();
    await this.view.reveal();

    const pre = present.precheck(skill, src.sent, !!this.key);
    if (pre) return this.show(present.error(pre));

    const controller = new AbortController();
    this.controller = controller;
    this.busy = { skill, since: Date.now() };
    this.post();
    const work = (async () => {
      try {
        const { run, free } = await api.runSkill(skill, src.sent, { key: this.key, options, signal: controller.signal });
        if (free !== null) this.free = free;
        if (this.controller !== controller) return;
        const bad = present.badOutput(run, skill);
        if (bad) return this.show(present.error(bad));
        const model = skill === 'detect' ? present.detect(run.output) : present.humanize(run.output, src.sent, src.selected);
        model.meta = present.meta(run, !!this.key);
        if (model.kind === 'humanize') model.replace = src.replaced ? null : { state: 'ready' };
        // The listed sentences, highlighted in the checked text, unless it changed while p3n checked.
        if (model.kind === 'detect') model.marked = this.highlights.show(src, marks(src.selected, run.output));
        this.show(model);
      } catch (e) {
        if (e.free != null) this.free = e.free;
        if (e.name === 'AbortError' || this.controller !== controller) return;
        this.show(present.error(e));
      } finally {
        if (this.controller === controller) {
          this.controller = null;
          this.busy = null;
          this.post();
          this.refreshAccount();
        }
      }
    })();
    vscode.window.withProgress({ location: { viewId: VIEW_ID } }, () => work);
    return work;
  }

  cancel() {
    if (!this.controller) return;
    this.controller.abort();
    this.controller = null;
    this.busy = null;
    this.post();
  }

  // Puts the rewrite where the selection was, as one undo step, and selects it.
  async replace() {
    const src = this.source;
    const model = this.result;
    if (!src || model?.kind !== 'humanize' || !model.replace) return;
    const refuse = (reason) => {
      model.replace = { state: 'refused', message: present.refused(reason) };
      this.post();
    };
    if (src.replaced) return refuse('replaced');
    let doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === src.uri.toString());
    if (!doc && src.uri.scheme !== 'untitled') {
      try { doc = await vscode.workspace.openTextDocument(src.uri); } catch { /* deleted or unreadable */ }
    }
    if (!doc || doc.isClosed) return refuse('gone');
    if (doc.getText(src.range) !== src.selected) return refuse('changed');
    // The document's own line ends, so the new selection below covers exactly the inserted text.
    const insert = model.insert.replace(/\r?\n/g, doc.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n');
    let editor;
    try {
      editor = await vscode.window.showTextDocument(doc, { viewColumn: src.viewColumn, preserveFocus: false, preview: false });
    } catch {
      return refuse('gone');
    }
    let ok = false;
    try {
      ok = await editor.edit((eb) => eb.replace(src.range, insert), { undoStopBefore: true, undoStopAfter: true });
    } catch { /* read-only */ }
    if (!ok) return refuse('readonly');
    const start = src.range.start;
    const end = doc.positionAt(doc.offsetAt(start) + insert.length);
    editor.selection = new vscode.Selection(start, end);
    editor.revealRange(new vscode.Range(start, end));
    src.replaced = true;
    model.replace = { state: 'done', message: present.REPLACED() };
    this.post();
  }

  // Show changes: the selection and the rewrite side by side in VS Code's diff editor, before Replace. The two
  // documents keep the file's name, so the diff highlights them like the file.
  async compare() {
    const src = this.source;
    const model = this.result;
    if (!src || model?.kind !== 'humanize') return;
    const uri = (side) => vscode.Uri.from({ scheme: DIFF_SCHEME, path: `/${this.seq}/${side}/${src.name}` });
    const [left, right] = [uri('selection'), uri('rewrite')];
    this.remember(left, src.selected);
    this.remember(right, model.insert);
    await vscode.commands.executeCommand('vscode.diff', left, right, present.compareTitle(src.where), { preview: true });
  }

  // VS Code asks for a document's text again when a closed diff is reopened, so keep the last few.
  remember(uri, text) {
    this.compared.set(uri.toString(), text.replace(/\r\n/g, '\n'));
    while (this.compared.size > 20) this.compared.delete(this.compared.keys().next().value);
  }

  provideTextDocumentContent(uri) {
    return this.compared.get(uri.toString()) ?? '';
  }

  async copy() {
    if (this.result?.kind === 'humanize') await vscode.env.clipboard.writeText(this.result.rewrite);
  }

  async refreshAccount() {
    if (!this.key) return;
    const key = this.key;
    try {
      const m = await api.me(key);
      if (key === this.key) this.account = { me: m };
    } catch (e) {
      if (key === this.key) this.account = { error: e.type };
    }
    this.post();
  }

  async onMessage(m) {
    switch (m?.type) {
      case 'ready': return this.post();
      case 'run': return (m.skill === 'detect' || m.skill === 'humanize') && this.run(m.skill);
      case 'again': return this.run('humanize', { again: true, options: { fresh: true } });
      case 'cancel': return this.cancel();
      case 'replace': return this.replace();
      case 'compare': return this.compare();
      case 'copy': return this.copy();
      case 'clear': return this.highlights.clear();
      case 'account': return vscode.commands.executeCommand('p3n.account');
      case 'command': return VIEW_COMMANDS.has(m.id) && vscode.commands.executeCommand(m.id);
      // Links go only to p3n's own site.
      case 'open': return present.isP3nUrl(m.url) && vscode.env.openExternal(vscode.Uri.parse(m.url));
      case 'rendered':
        if (!this.test) return;
        this.lastRendered = { text: String(m.text ?? ''), theme: String(m.theme ?? ''), accent: String(m.accent ?? '') };
        return this.rendered.fire(this.lastRendered);
    }
  }
}

module.exports = { P3n, SECRET, VIEW_ID, DIFF_SCHEME };
