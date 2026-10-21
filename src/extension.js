// p3n for VS Code: check selected text for AI writing, and rewrite it in place. https://p3n.si
const vscode = require('vscode');
const api = require('./api');
const { P3n, VIEW_ID } = require('./p3n');
const { View } = require('./view');
const keys = require('./keys');

async function activate(context) {
  const production = context.extensionMode === vscode.ExtensionMode.Production;
  // The tests run against a stand-in API. An installed extension always calls api.p3n.si.
  if (!production && process.env.P3N_API_URL) api.setBase(process.env.P3N_API_URL);

  const view = new View(context.extensionUri);
  const p3n = new P3n(context, view);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_ID, view),
    vscode.commands.registerCommand('p3n.check', () => p3n.run('detect')),
    vscode.commands.registerCommand('p3n.rewrite', () => p3n.run('humanize')),
    // A key passed in skips the input box: for the tests only, so no other extension can set one.
    vscode.commands.registerCommand('p3n.setKey', (given) => keys.setKey(context, production || typeof given !== 'string' ? undefined : given)),
    vscode.commands.registerCommand('p3n.removeKey', () => keys.removeKey(context)),
    vscode.commands.registerCommand('p3n.account', () => keys.accountMenu(context, !!p3n.key)),
  );
  await p3n.init();
  // The tests read the state and the view's text through this.
  return context.extensionMode === vscode.ExtensionMode.Test ? { p3n } : undefined;
}

function deactivate() {}

module.exports = { activate, deactivate };
