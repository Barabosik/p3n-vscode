// Screenshots from a real VS Code, driven like a user: select a paragraph, run p3n from the right-click menu
// and the command palette, click Replace selection in the view, undo with Ctrl+Z.
//
//   node dev/shots.js            installs the built .vsix into a fresh profile and uses the live API: 2 keyless calls
//   MOCK=1 node dev/shots.js     loads this folder as a development extension against a stand-in API: no calls
//   SMOKE=1 node dev/shots.js    installs the built .vsix and checks it loads (right-click items, the view): no calls
//
// Writes dev/out/shots/*.png. The VS Code window opens on screen for about a minute; the script drives it over
// the Chrome DevTools Protocol, so it doesn't need focus. VSIX=path picks the package, PORT the debugging port.
const path = require('node:path');
const fs = require('node:fs');
const cp = require('node:child_process');
const http = require('node:http');
const { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath } = require('@vscode/test-electron');
const { FIXTURES, SHORT } = require('../test/fixtures');
const { version } = require('../package.json');

const ROOT = path.resolve(__dirname, '..');
const MOCK = !!process.env.MOCK;
const OUT = path.join(ROOT, 'dev', 'out', 'shots');
const RUN = path.join(ROOT, 'dev', 'out', 'shots-run');
const PORT = Number(process.env.PORT || 9419);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[shots]', ...a);

// ---- the stand-in API (MOCK=1) ---------------------------------------------------------------

function mockApi() {
  const server = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      const skill = req.url.replace('/v1/', '');
      const body = FIXTURES[skill] ?? { error: { type: 'not_found', message: 'No such path.' } };
      // Like the live API, a rewrite takes a moment.
      setTimeout(() => {
        res.writeHead(FIXTURES[skill] ? 200 : 404, { 'Content-Type': 'application/json', 'X-Free-Remaining': skill === 'detect' ? '9' : '8' });
        res.end(JSON.stringify(body));
      }, skill === 'humanize' ? 1500 : 600);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// ---- a small CDP client over the browser endpoint (flattened sessions) ----------------------------

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(`${m.error.message} ${m.error.data ?? ''}`)) : resolve(m.result);
      }
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    return new Cdp(ws);
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

async function json(url) {
  for (let i = 0; i < 120; i++) {
    try {
      return await (await fetch(url)).json();
    } catch { await sleep(500); }
  }
  throw new Error(`No answer from ${url}`);
}

// ---- driving the window --------------------------------------------------------------------------

let cdp;
let page; // the workbench's session id

const editorText = () => evaluate(`document.querySelector('.monaco-editor .view-lines')?.innerText.replace(/\u00a0/g, ' ') ?? ''`);
const evaluate = async (expression, sessionId = page) => {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};

async function until(fn, what, ms = 30_000) {
  const t0 = Date.now();
  for (;;) {
    let v;
    try { v = await fn(); } catch { v = null; }
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error(`Timed out: ${what}`);
    await sleep(250);
  }
}

const KEYS = {
  Enter: { code: 'Enter', keyCode: 13, text: '\r' }, Escape: { code: 'Escape', keyCode: 27 }, Down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
  Home: { code: 'Home', keyCode: 36 }, F10: { code: 'F10', keyCode: 121 }, g: { code: 'KeyG', keyCode: 71 }, l: { code: 'KeyL', keyCode: 76 }, p: { code: 'KeyP', keyCode: 80 }, z: { code: 'KeyZ', keyCode: 90 },
};
const MOD = { alt: 1, ctrl: 2, meta: 4, shift: 8 };
async function press(combo) {
  const parts = combo.split('+');
  const name = parts.pop();
  const k = KEYS[name];
  const modifiers = parts.reduce((m, p) => m | MOD[p.toLowerCase()], 0);
  const base = { key: k.key ?? name, code: k.code, windowsVirtualKeyCode: k.keyCode, nativeVirtualKeyCode: k.keyCode, modifiers };
  await cdp.send('Input.dispatchKeyEvent', { type: k.text && !modifiers ? 'keyDown' : 'rawKeyDown', ...base, ...(k.text && !modifiers ? { text: k.text, unmodifiedText: k.text } : {}) }, page);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base }, page);
  await sleep(150);
}
const type = async (text) => { await cdp.send('Input.insertText', { text }, page); await sleep(200); };

async function click(x, y) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }, page);
  await sleep(60);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }, page);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }, page);
  await sleep(200);
}

async function shot(name) {
  await sleep(350);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, page);
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  log('saved', `dev/out/shots/${name}.png`);
}

// The p3n view's text, read from inside its webview (the content frame is the webview's same-origin child).
let viewSession = null;
async function viewText() {
  if (!viewSession) {
    const { targetInfos } = await cdp.send('Target.getTargets');
    const t = targetInfos.find((t) => t.type === 'iframe' && t.url.includes('extensionId=nikita-andreiev.p3n-vscode'));
    if (!t) return null;
    ({ sessionId: viewSession } = await cdp.send('Target.attachToTarget', { targetId: t.targetId, flatten: true }));
  }
  return evaluate(`document.querySelector('iframe')?.contentDocument?.body?.innerText ?? ''`, viewSession);
}

// Where an element of the view is, in the workbench's coordinates: the webview's iframe, the content frame
// inside it, the element inside that.
async function viewRect(selector) {
  const outer = await evaluate(`(() => { const f = [...document.querySelectorAll('iframe')].find((f) => f.src.includes('extensionId=nikita-andreiev.p3n-vscode')); const r = f?.getBoundingClientRect(); return r && { x: r.x, y: r.y }; })()`);
  const inner = await evaluate(`(() => { const f = document.querySelector('iframe'); const fr = f.getBoundingClientRect(); const r = f.contentDocument.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r && { x: fr.x + r.x + r.width / 2, y: fr.y + r.y + r.height / 2 }; })()`, viewSession);
  return outer && inner && { x: outer.x + inner.x, y: outer.y + inner.y };
}

// A context-menu item by its label. Monaco draws menus in a shadow root.
async function menuItem(label) {
  return evaluate(`(() => {
    const roots = [document, ...[...document.querySelectorAll('*')].filter((e) => e.shadowRoot).map((e) => e.shadowRoot)];
    for (const r of roots) for (const el of r.querySelectorAll('.monaco-menu .action-label')) {
      if (el.textContent.trim() === ${JSON.stringify(label)}) { const b = el.getBoundingClientRect(); if (b.width) return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }
    }
    return null;
  })()`);
}

// Selects a whole line (a paragraph, wrapped on screen) of the open file: Go to Line, then Ctrl+L.
async function selectLine(n) {
  await press('Ctrl+g');
  await type(String(n));
  await press('Enter');
  await press('Ctrl+l');
}

async function setTheme(settingsFile, theme) {
  const s = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  s['workbench.colorTheme'] = theme;
  fs.writeFileSync(settingsFile, JSON.stringify(s, null, 2));
  await sleep(1500);
}

// ---- the run -------------------------------------------------------------------------------------

(async () => {
  fs.rmSync(RUN, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  fs.mkdirSync(OUT, { recursive: true });
  const profile = path.join(RUN, 'profile');
  const extensions = path.join(RUN, 'extensions');
  const workspace = path.join(RUN, 'workspace');
  fs.mkdirSync(path.join(profile, 'User'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'test', 'integration', 'fixtures'), workspace, { recursive: true });
  const settingsFile = path.join(profile, 'User', 'settings.json');
  fs.writeFileSync(settingsFile, JSON.stringify({
    'workbench.colorTheme': 'Default Light Modern',
    'workbench.startupEditor': 'none',
    'workbench.tips.enabled': false,
    'workbench.secondarySideBar.defaultVisibility': 'hidden',
    'workbench.layoutControl.enabled': false,
    'workbench.editor.empty.hint': 'hidden',
    'chat.disableAIFeatures': true,
    'chat.commandCenter.enabled': false,
    'window.titleBarStyle': 'custom',
    'window.restoreWindows': 'none',
    'editor.minimap.enabled': false,
    'editor.fontSize': 15,
    'editor.lineHeight': 24,
    'editor.wordWrap': 'on',
    'editor.stickyScroll.enabled': false,
    'editor.unicodeHighlight.ambiguousCharacters': false,
    'breadcrumbs.enabled': false,
    'git.enabled': false,
    'update.mode': 'none',
    'extensions.autoCheckUpdates': false,
    'extensions.ignoreRecommendations': true,
    'telemetry.telemetryLevel': 'off',
    'security.workspace.trust.enabled': false,
  }, null, 2));

  const exe = await downloadAndUnzipVSCode(process.env.VSCODE_VERSION || 'stable');
  const args = [`--user-data-dir=${profile}`, `--extensions-dir=${extensions}`];
  let server;
  const env = { ...process.env };
  delete env.P3N_API_URL;
  if (MOCK) {
    server = await mockApi();
    env.P3N_API_URL = `http://127.0.0.1:${server.address().port}`;
    args.push(`--extensionDevelopmentPath=${ROOT}`);
  } else {
    const vsix = process.env.VSIX || path.join(ROOT, `p3n-vscode-${version}.vsix`);
    if (!fs.existsSync(vsix)) throw new Error(`No ${path.basename(vsix)}: run npm run package first.`);
    const [cli, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(exe);
    const r = cp.spawnSync(cli, [...cliArgs, ...args, '--install-extension', vsix], { encoding: 'utf8', shell: process.platform === 'win32' });
    log((r.stdout + r.stderr).trim());
    if (r.status !== 0) throw new Error('Installing the .vsix failed.');
    log('installed:', fs.readdirSync(extensions).filter((d) => d.startsWith('nikita-andreiev.')).join(', '));
  }

  log(MOCK ? 'stand-in API, development extension' : `${process.env.SMOKE ? 'install check' : 'live API'}, installed ${path.basename(process.env.VSIX || `p3n-vscode-${version}.vsix`)}`);
  const code = cp.spawn(exe, [...args, `--remote-debugging-port=${PORT}`, '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes', '--new-window', workspace, path.join(workspace, 'essay.md')], { env, stdio: 'ignore' });
  let calls = 0;
  try {
    const { webSocketDebuggerUrl } = await json(`http://127.0.0.1:${PORT}/json/version`);
    cdp = await Cdp.connect(webSocketDebuggerUrl);
    const target = await until(async () => (await cdp.send('Target.getTargets')).targetInfos.find((t) => t.type === 'page' && /workbench/.test(t.url)), 'the workbench');
    ({ sessionId: page } = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true }));
    // Electron has no Browser.setWindowBounds: lay the page out at a fixed size instead, for even shots.
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1.5, mobile: false }, page);
    if (process.env.DEBUG) {
      await sleep(8000);
      log((await cdp.send('Target.getTargets')).targetInfos.map((t) => `${t.type} ${t.url.slice(0, 90)}`).join(' || '));
      log(await evaluate(`document.title + ' | ' + (document.querySelector('.monaco-editor .view-lines')?.innerText ?? 'no editor').slice(0, 80)`));
      await shot('debug');
    }
    await until(async () => (await editorText()).includes('Team update'), 'essay.md in the editor', 60_000);
    await sleep(2500);

    // SMOKE=1: the installed package loads, with both items in the right-click menu and the view drawn. No calls.
    if (process.env.SMOKE && !MOCK) {
      await selectLine(3);
      await press('Shift+F10');
      await until(async () => (await menuItem('p3n: Check for AI')) && menuItem('p3n: Rewrite'), 'p3n in the right-click menu', 15_000);
      log('right-click menu: p3n: Check for AI, p3n: Rewrite');
      await press('Escape');
      const icon = await evaluate(`(() => { const a = [...document.querySelectorAll('.activitybar .action-label')].find((e) => /^p3n/i.test(e.getAttribute('aria-label') || '')); const r = a?.getBoundingClientRect(); return r && { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      if (!icon) throw new Error('No p3n icon in the activity bar.');
      await click(icon.x, icon.y);
      const text = await until(async () => /Free without a key/.test((await viewText()) ?? '') && viewText(), 'the p3n view', 20_000);
      log('view:', text.split(/\n/).filter(Boolean).join(' | '));
      await shot('smoke');
      return;
    }

    // 1. Check for AI from the right-click menu.
    await selectLine(3);
    await press('Shift+F10');
    const item = await until(() => menuItem('p3n: Check for AI'), 'p3n in the right-click menu', 10_000);
    await shot('menu');
    await click(item.x, item.y);
    calls++;
    const checked = await until(async () => /likely AI|used up|answered|Can't reach/.test((await viewText()) ?? '') && viewText(), 'the Check result', 90_000);
    log('check:', checked.split('\n').slice(0, 12).join(' | '));
    await sleep(1800); // the score's count-up
    await shot('check-light');
    await setTheme(settingsFile, 'Default Dark Modern');
    await shot('check-dark');

    // 2. Rewrite from the command palette, then Replace selection, then undo.
    await selectLine(5);
    await press('Ctrl+Shift+p');
    await type('p3n: Rewrite');
    await sleep(600);
    await press('Enter');
    calls++;
    const rewritten = await until(async () => /reads as AI|Doesn't read|used up|answered|Can't reach/.test((await viewText()) ?? '') && viewText(), 'the Rewrite result', 120_000);
    log('rewrite:', rewritten.split('\n').slice(0, 14).join(' | '));
    await sleep(1800);
    await shot('rewrite-dark');
    await setTheme(settingsFile, 'Default Light Modern');
    await shot('rewrite-light');
    const rep = await viewRect('#replace');
    if (rep) {
      await click(rep.x, rep.y);
      await until(async () => /Replaced in the editor/.test((await viewText()) ?? ''), 'Replaced', 10_000);
      await shot('replaced-light');
      log('editor after Replace still has the original paragraph:', (await editorText()).includes(SHORT.slice(0, 40)));
      await press('Ctrl+z');
      await sleep(500);
      log('Ctrl+Z restored the paragraph:', (await editorText()).includes(SHORT.slice(0, 40)));
      await shot('undone-light');
    } else {
      log('no Replace selection button: the rewrite failed, see the shot');
    }
  } catch (e) {
    console.error('[shots] failed:', e.stack ?? e);
    process.exitCode = 1;
  } finally {
    log(`${MOCK ? 'stand-in' : 'live'} API calls made: ${calls}`);  // SMOKE makes none
    // A closed socket never answers: don't wait on it.
    await Promise.race([cdp?.send('Browser.close').catch(() => {}), sleep(2000)]);
    await sleep(1500);
    if (code.exitCode === null) code.kill();
    server?.close();
  }
})().catch((e) => {
  console.error('[shots] failed:', e.stack ?? e);
  process.exitCode = 1;
});
