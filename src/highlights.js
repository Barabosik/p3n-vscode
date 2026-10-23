// The sentences a Check lists, highlighted in the editor: the listed sentences with a tint and a solid underline,
// pattern hits with a lighter tint and a dotted one, the reason on hover. Cleared on the next run, on any edit to
// the document, and by p3n: Clear highlights. The colours are contributed in package.json, so themes can change them.
const vscode = require('vscode');

const STYLES = {
  sentence: { background: 'p3n.sentenceBackground', underline: 'p3n.sentenceUnderline', style: 'solid' },
  hit: { background: 'p3n.hitBackground', underline: 'p3n.hitUnderline', style: 'dotted' },
};

class Highlights {
  constructor(onChange) {
    this.onChange = onChange;
    this.types = {};
    for (const [kind, s] of Object.entries(STYLES)) {
      this.types[kind] = vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor(s.background),
        borderColor: new vscode.ThemeColor(s.underline),
        borderStyle: `none none ${s.style} none`,
        borderWidth: '0 0 2px 0',
        overviewRulerColor: new vscode.ThemeColor(s.underline),
        overviewRulerLane: vscode.OverviewRulerLane.Center,
      });
    }
    this.current = null; // { uri, version, range, text, marks: [{ kind, range, why }] }: the checked text, as it was
    this.shown = new WeakMap(); // editor → the marks set on it, which the API can't read back (the tests do)
    this.disposables = [
      ...Object.values(this.types),
      vscode.workspace.onDidChangeTextDocument((e) => { if (e.contentChanges.length && this.isFor(e.document)) this.clear(); }),
      vscode.workspace.onDidCloseTextDocument((doc) => { if (this.isFor(doc)) this.clear(); }),
      // An editor that was hidden comes back without decorations.
      vscode.window.onDidChangeVisibleTextEditors((editors) => this.paint(editors)),
    ];
  }

  isFor(doc) { return !!this.current && doc.uri.toString() === this.current.uri.toString(); }

  // The document is unchanged since the check: same version, same text in the checked range.
  unchanged(doc) { return this.isFor(doc) && doc.version === this.current.version && doc.getText(this.current.range) === this.current.text; }

  // `marks` are offsets into `src.selected` (marks.js). Nothing is marked if the document changed while p3n checked.
  show(src, marks) {
    this.clear();
    const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === src.uri.toString());
    if (!doc || doc.isClosed || doc.version !== src.version || !marks.length) return false;
    const base = doc.offsetAt(src.range.start);
    const range = (m) => new vscode.Range(doc.positionAt(base + m.start), doc.positionAt(base + m.end));
    this.current = { uri: src.uri, version: src.version, range: src.range, text: src.selected, marks: marks.map((m) => ({ kind: m.kind, range: range(m), why: m.why })) };
    this.paint();
    this.onChange();
    return true;
  }

  paint(editors = vscode.window.visibleTextEditors) {
    for (const ed of editors) {
      if (!this.unchanged(ed.document)) continue;
      for (const kind of Object.keys(STYLES)) {
        ed.setDecorations(this.types[kind], this.current.marks.filter((m) => m.kind === kind).map((m) => ({
          range: m.range,
          hoverMessage: m.why ? new vscode.MarkdownString().appendText(m.why) : undefined,
        })));
      }
      this.shown.set(ed, this.current.marks);
    }
  }

  clear() {
    if (!this.current) return;
    for (const ed of vscode.window.visibleTextEditors) {
      if (!this.shown.has(ed)) continue;
      for (const type of Object.values(this.types)) ed.setDecorations(type, []);
      this.shown.delete(ed);
    }
    this.current = null;
    this.onChange();
  }

  dispose() {
    this.current = null;
    for (const d of this.disposables) d.dispose();
  }
}

module.exports = { Highlights };
