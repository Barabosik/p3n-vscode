# Privacy

p3n for VS Code sends text to p3n only when you ask it to.

- **What it sends.** The text you selected, when you run Check for AI or Rewrite from the right-click menu, the command palette or the p3n view. If you added an API key, the key goes with it so p3n can bill your account, and the view uses it to show your balance. Each call also names the extension and its version (for example `p3n-vscode/0.1.0`), so your usage page can show which tool made it.
- **Where it goes.** Only to `api.p3n.si`, over HTTPS. The view's links (p3n.si, Sign up, Top up, API keys) open p3n.si in your browser.
- **What it doesn't do.** It reads nothing until you run a command, and never looks at your files or workspace on its own. It keeps no history, and has no telemetry, analytics or ads.
- **What stays on your device.** Your API key, in VS Code's secret storage, encrypted with your system's keychain. It's never written to settings.json, and Settings Sync doesn't copy it. Remove API key deletes it. The last result, and the texts that Show changes compared, stay in memory until you close VS Code.

What p3n does with the text it receives:
- It keeps the text for up to 7 days, to return results and debug failures, then deletes it.
- It sends the text through OpenRouter to the AI model providers that run the check or rewrite.
- It logs the time and IP address of each call. That's how the free limit works.
- It doesn't sell data or use your text to train models.

The full policy is at [p3n.si/privacy](https://p3n.si/privacy). Questions go to [p3n.si/contact](https://p3n.si/contact).
