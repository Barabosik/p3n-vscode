# Changelog

## 0.1.4

- A **p3n.si ↗** link at the bottom of the p3n view, under the free calls or your balance, opens p3n.si in your browser. It's there with or without an API key.
- **p3n: Open p3n.si** in the command palette does the same.

## 0.1.3

- **Show changes**, under a rewrite, opens your selection and the rewrite side by side in VS Code's diff editor, so you can read what changed before you replace anything. Nothing in your file changes until you click **Replace selection**.
- A selection under eight words now gets "Rewrite needs at least a sentence of eight words. Select more." before anything is sent, like the other p3n apps, instead of the API's error.
- Over the 5,000 characters p3n takes without a key, the message now has an **Add an API key** button.
- "Rewriting… N s" keeps counting from the start when you hide the p3n view and show it again during a run. It used to start again at 0.
- When **p3n: Set API key** can't reach p3n, it says the key wasn't saved, and no longer offers the API keys page, which can't help with that.
- The README on the Marketplace and Open VSX links Open VSX and has its install steps. It lists the commands, and how to give them keyboard shortcuts of your own; p3n still sets none.

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
