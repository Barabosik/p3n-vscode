<p align="center">
  <img src="images/icon.png" width="88" alt="">
</p>

<h1 align="center">p3n for VS Code</h1>

<p align="center">
  Select text in the editor. See if it reads as AI-written, or rewrite it in place.
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=nikita-andreiev.p3n-vscode">VS Code Marketplace</a> · <a href="https://open-vsx.org/extension/nikita-andreiev/p3n-vscode">Open VSX</a> · <a href="https://p3n.si">p3n.si</a> · <a href="https://nikita-andreiev.com/p3n/">All p3n apps</a>
</p>

<p align="center">
  <a href="https://github.com/Barabosik/p3n-vscode/actions/workflows/ci.yml"><img src="https://github.com/Barabosik/p3n-vscode/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=nikita-andreiev.p3n-vscode"><img src="https://vsmarketplacebadges.dev/version-short/nikita-andreiev.p3n-vscode.svg?label=VS%20Code%20Marketplace" alt="VS Code Marketplace version"></a>
  <a href="https://open-vsx.org/extension/nikita-andreiev/p3n-vscode"><img src="https://img.shields.io/open-vsx/v/nikita-andreiev/p3n-vscode?label=Open%20VSX" alt="Open VSX version"></a>
</p>

![Check for AI](images/check-light.png)

## What it does

- **Check for AI.** A score, a one-line reason, and the sentences that give it away.
- **Rewrite.** A version that keeps your facts and drops the filler. **Replace selection** puts it where your selection was, as one undo step.
- Results open in the p3n view in the side bar, in your light or dark theme.
- Works on any text you can select: Markdown, plain text, docs, comments, commit messages.

![Rewrite and replace, in a dark theme](images/rewrite-dark.png)

## Use

1. Select text in an editor.
2. Right-click it and choose **p3n: Check for AI** or **p3n: Rewrite**. Both are in the command palette (Ctrl+Shift+P) too, and the p3n view has buttons for them.
3. After a rewrite, click **Replace selection**. Ctrl+Z (Cmd+Z on a Mac) in the editor undoes it. **Copy** and **Try another rewrite** are next to it.

## Free, or with a key

You get 10 checks or rewrites an hour without an account, up to 5,000 characters each. For more, [sign up at p3n.si](https://p3n.si/register) (you get free credit), make a key on the [API keys](https://p3n.si/dashboard/keys) page, and run **p3n: Set API key**. With a key, p3n takes up to 200,000 characters and bills your p3n balance.

The key is kept in VS Code's secret storage, encrypted with your system's keychain. It's never written to settings.json and isn't synced. **p3n: Remove API key** deletes it.

## Privacy

The extension sends the text you selected to `api.p3n.si`, and only when you run Check for AI or Rewrite. The extension keeps no history and has no telemetry. p3n.si keeps the text for up to 7 days. The details are in [PRIVACY.md](PRIVACY.md).

## Install

### From the VS Code Marketplace

Install [p3n from the Marketplace](https://marketplace.visualstudio.com/items?itemName=nikita-andreiev.p3n-vscode). You can also search for **p3n** in the Extensions view (Ctrl+Shift+X, or Cmd+Shift+X on a Mac) and click **Install**. From a terminal:

```bash
code --install-extension nikita-andreiev.p3n-vscode
```

Marketplace installs update themselves. You need VS Code 1.90 or later.

### From Open VSX

For VSCodium, Cursor and Windsurf: install [p3n from Open VSX](https://open-vsx.org/extension/nikita-andreiev/p3n-vscode), or search for **p3n** in their Extensions view. Open VSX installs update themselves.

### Install from VSIX

If you can't use either store, install the `.vsix` file from a release. It's the same package the stores have.

1. Download the `.vsix` file from the [latest release](https://github.com/Barabosik/p3n-vscode/releases/latest).
2. In VS Code, open the Extensions view (Ctrl+Shift+X, or Cmd+Shift+X on a Mac).
3. Click **…** at the top of the view, choose **Install from VSIX…** and pick the file.
4. The p3n pen appears in the activity bar. Select some text and right-click it to start.

From a terminal, `code --install-extension` with the file's path does the same. VSCodium, Cursor and Windsurf install a `.vsix` the same way.

An install from a `.vsix` doesn't update itself. To update, install the next release's file over it, or install p3n from a store instead.

### From source

Run `npm ci` and `npm run package`, then install the `p3n-vscode-<version>.vsix` it writes, as above.

## Known gaps

- With several cursors, p3n uses the main selection.
- Desktop VS Code only for now. vscode.dev and github.dev aren't supported yet.
- Rewrite is for prose. On code it treats everything as text, so check the result before you keep it.

## Other p3n apps

p3n also works in [Chrome and Firefox](https://nikita-andreiev.com/p3n/#browser), [Word and Excel](https://nikita-andreiev.com/p3n/#office), [Google Docs](https://nikita-andreiev.com/p3n/#docs), [Obsidian](https://nikita-andreiev.com/p3n/#obsidian) and [Sublime Text](https://nikita-andreiev.com/p3n/#sublime). Install steps for each are on [nikita-andreiev.com/p3n](https://nikita-andreiev.com/p3n/).

## Open source

MIT licence. Bugs and ideas go in [issues](https://github.com/Barabosik/p3n-vscode/issues). Tests and builds are in [CONTRIBUTING.md](CONTRIBUTING.md).
