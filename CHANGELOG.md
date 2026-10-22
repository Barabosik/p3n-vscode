# Changelog

## 0.1.2

- The README's Open VSX link is gone: p3n isn't on Open VSX yet. VSCodium, Cursor and Windsurf install the `.vsix` from GitHub Releases.
- The free-limit message says "free calls", not "free checks". It and the API key prompt ask you to sign up at p3n.si before you create a key.
- The note under a rewrite says "The rewrite" instead of "Humanize".
- Wording only; no behaviour changes.

## 0.1.1

- The README's install steps point to the VS Code Marketplace and Open VSX, with the `.vsix` from GitHub Releases as the fallback.
- No code changes.

## 0.1.0

First release.

- **p3n: Check for AI** on the editor's selection: a score, a reason, and the sentences that read as AI.
- **p3n: Rewrite**, with **Replace selection** as one undo step, **Copy** and **Try another rewrite**.
- Both commands are in the right-click menu, the command palette and the p3n view in the side bar.
- Free without an account: 10 calls an hour, up to 5,000 characters each. An optional API key, set with **p3n: Set API key**, is kept in VS Code's secret storage.
- The view follows the editor's light, dark and high-contrast themes.
