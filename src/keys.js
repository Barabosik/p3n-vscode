// The optional API key: asked for in an input box, checked with p3n, kept in VS Code's SecretStorage
// (the OS keychain), never in settings.json.
const vscode = require('vscode');
const api = require('./api');
const { SECRET } = require('./p3n');

const KEY_SHAPE = /^p3n_\S+$/;
const WRONG_SHAPE = 'Keys start with p3n_. Copy the whole key from the API keys page.';
const open = (url) => vscode.env.openExternal(vscode.Uri.parse(url));

// Checks the key with p3n and saves it only if it works, so a typo never replaces a good key.
// `given` skips the input box; only the tests pass it (extension.js).
async function setKey(context, given) {
  const k = (given ?? await vscode.window.showInputBox({
    title: 'p3n API key',
    prompt: "Paste your p3n API key. No key yet? Sign up at p3n.si, then create one at p3n.si/dashboard/keys. It's kept in VS Code's secret storage on this device.",
    placeHolder: 'p3n_…',
    password: true,
    ignoreFocusOut: true,
    validateInput: (v) => (!v.trim() || KEY_SHAPE.test(v.trim()) ? null : WRONG_SHAPE),
  }))?.trim();
  if (!k) return false;
  if (!KEY_SHAPE.test(k)) {
    vscode.window.showWarningMessage(WRONG_SHAPE);
    return false;
  }
  try {
    const m = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'p3n: Checking the key…' }, () => api.me(k));
    await context.secrets.store(SECRET, k);
    vscode.window.showInformationMessage(`p3n: Saved. Signed in as ${m.email}, balance $${Number(m.balance_usd).toFixed(2)}.`);
    return true;
  } catch (e) {
    const msg = e.type === 'unauthorized' ? "p3n doesn't accept this key, so it wasn't saved. Copy it again from the API keys page." : e.message;
    vscode.window.showErrorMessage(msg, 'Open API keys').then((pick) => pick && open(api.LINKS.keys));
    return false;
  }
}

async function removeKey(context) {
  await context.secrets.delete(SECRET);
  vscode.window.showInformationMessage('p3n: Key removed. p3n still works without one, with the free hourly limit.');
}

// The view's account link: add a key, or change, remove and top up.
async function accountMenu(context, hasKey) {
  const items = hasKey
    ? [
      { label: 'Change the key', run: () => setKey(context) },
      { label: 'Remove the key', run: () => removeKey(context) },
      { label: 'Top up', description: 'p3n.si', run: () => open(api.LINKS.billing) },
      { label: 'API keys', description: 'p3n.si', run: () => open(api.LINKS.keys) },
    ]
    : [
      { label: 'Paste an API key', run: () => setKey(context) },
      { label: 'Get a key', description: 'Sign up at p3n.si for free credit', run: () => open(api.LINKS.signup) },
    ];
  const pick = await vscode.window.showQuickPick(items, {
    title: 'p3n',
    placeHolder: hasKey ? 'Your API key' : 'Without a key: 10 calls an hour, up to 5,000 characters each',
  });
  await pick?.run();
}

module.exports = { setKey, removeKey, accountMenu };
