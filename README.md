<p align="center">
  <img src="images/icon.png" width="88" alt="">
</p>

<h1 align="center">p3n for VS Code</h1>

<p align="center">
  Select text in the editor. See if it reads as AI-written, or rewrite it in place.
</p>

<p align="center">
  <a href="https://p3n.si">p3n.si</a> · <a href="https://nikita-andreiev.com/p3n/">All p3n apps</a>
</p>

<p align="center">
  <a href="https://github.com/Barabosik/p3n-vscode/actions/workflows/ci.yml"><img src="https://github.com/Barabosik/p3n-vscode/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
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

You get 10 checks or rewrites an hour without an account, up to 5,000 characters each. For more, make an API key at [p3n.si](https://p3n.si/dashboard/keys) and run **p3n: Set API key**. With a key, p3n takes up to 200,000 characters and bills your p3n balance.

The key is kept in VS Code's secret storage, encrypted with your system's keychain. It's never written to settings.json and isn't synced. **p3n: Remove API key** deletes it.

## Privacy

p3n sends the text you selected, only when you run Check for AI or Rewrite, and only to `api.p3n.si`. It keeps no history and has no telemetry. The details are in [PRIVACY.md](PRIVACY.md).

## Install

- VS Code Marketplace and Open VSX (for VSCodium, Cursor and Windsurf): coming soon.
- From source: run `npm ci` and `npm run package`. Then in VS Code open the Extensions view, click **…**, choose **Install from VSIX…** and pick `p3n-vscode-0.1.0.vsix`.

## Known gaps

- With several cursors, p3n uses the main selection.
- Desktop VS Code only for now. vscode.dev and github.dev aren't supported yet.
- Rewrite is for prose. On code it treats everything as text, so check the result before you keep it.

## Open source

MIT licence. Bugs and ideas go in [issues](https://github.com/Barabosik/p3n-vscode/issues). Tests and builds are in [CONTRIBUTING.md](CONTRIBUTING.md).

p3n is also a [browser extension](https://github.com/Barabosik/p3n-chrome-extension) for Chrome and Firefox, an [add-in](https://github.com/Barabosik/p3n-office-addin) for Word and Excel, and a Google Docs add-on. They all use the same [p3n API](https://p3n.si/docs).
