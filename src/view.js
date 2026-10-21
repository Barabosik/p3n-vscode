// The p3n view in the side bar: a webview that draws the state p3n.js sends and posts clicks back.
const vscode = require('vscode');
const crypto = require('node:crypto');

class View {
  constructor(extensionUri) {
    this.media = vscode.Uri.joinPath(extensionUri, 'media');
    this.webviewView = null;
    this.ready = false;
    this.onMessage = () => {};
  }

  resolveWebviewView(webviewView) {
    this.webviewView = webviewView;
    this.ready = false;
    const { webview } = webviewView;
    webview.options = { enableScripts: true, localResourceRoots: [this.media] };
    webview.html = this.html(webview);
    webview.onDidReceiveMessage((m) => {
      if (m?.type === 'ready') this.ready = true;
      this.onMessage(m);
    });
    webviewView.onDidDispose(() => {
      this.webviewView = null;
      this.ready = false;
    });
  }

  // Until the page says it's ready, it would drop the message; it asks for the state then.
  post(state) {
    if (this.webviewView && this.ready) this.webviewView.webview.postMessage({ type: 'state', state });
  }

  // Shows the view, keeping focus in the editor once the view exists.
  async reveal() {
    if (this.webviewView) this.webviewView.show(true);
    else await vscode.commands.executeCommand('p3n.view.focus');
  }

  html(webview) {
    const nonce = crypto.randomBytes(16).toString('base64');
    const src = (f) => webview.asWebviewUri(vscode.Uri.joinPath(this.media, f));
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="${src('view.css')}">
  <title>p3n</title>
</head>
<body>
  <header class="bar">
    <button type="button" class="brand" data-open="https://p3n.si" title="p3n.si">
      <img class="light-only" src="${src('logo.png')}" width="22" height="22" alt="">
      <img class="dark-only" src="${src('logo-dark.png')}" width="22" height="22" alt="">
      <span class="wordmark">p<span>3</span>n</span>
    </button>
    <button type="button" id="account" class="link small"></button>
  </header>
  <main>
    <section class="actions">
      <div class="row">
        <button type="button" id="check" class="btn primary">Check for AI</button>
        <button type="button" id="rewrite" class="btn secondary">Rewrite</button>
      </div>
      <p id="source" class="small muted" hidden></p>
      <p id="intro" class="small muted">Select text in the editor, then click Check for AI or Rewrite. Both are in the editor's right-click menu and the command palette too.</p>
    </section>
    <section id="busy" class="busy" hidden>
      <div class="progress"><i></i></div>
      <div class="row between">
        <span id="busy-text" class="small muted"></span>
        <button type="button" id="cancel" class="link small">Cancel</button>
      </div>
    </section>
    <section id="result" aria-live="polite"></section>
  </main>
  <footer id="quota" class="small muted"></footer>
  <script nonce="${nonce}" src="${src('view.js')}"></script>
</body>
</html>`;
  }
}

module.exports = { View };
