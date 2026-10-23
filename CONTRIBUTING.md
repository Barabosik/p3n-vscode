# Contributing

Plain JavaScript with no bundler and no runtime dependencies. VS Code loads `src/extension.js` as it is. `dev/` and `test/` hold the tools and tests, and aren't packaged.

## Layout

- `src/extension.js`: registers the commands and the view.
- `src/p3n.js`: the state. It takes the editor's selection, calls p3n, keeps the result, shows a rewrite next to the selection in VS Code's diff editor (two read-only `p3n:` documents in memory), and puts it back with one `TextEditor.edit`, so a single undo reverts it.
- `src/api.js`: the API client. It's the same code as the browser extension's and the Word add-in's, in CommonJS.
- `src/present.js`: everything the view says. The wording matches the other p3n clients, and it doesn't use `vscode`, so it's unit-tested in plain Node.
- `src/marks.js`: finds the sentences a Check lists in the checked text, for the highlights. It doesn't use `vscode` either.
- `src/highlights.js`: draws those highlights in the editor and clears them on an edit, the next run, or Clear highlights.
- `src/keys.js`: the API key commands. The key goes in `context.secrets`, never in settings.
- `src/view.js` and `media/`: the webview in the side bar. It draws the state it's sent, using VS Code's theme colours, and posts clicks back. Its content security policy allows only its own script and styles.

## Test

```bash
npm ci
npm run test:unit
npm run test:integration
```

- `test:unit` runs the API client against a stubbed `fetch`, and checks the wording for each kind of answer.
- `test:integration` downloads VS Code into `.vscode-test/` and runs `test/integration/suite` inside it, against a stand-in API on localhost. It opens a VS Code window for about 30 seconds. On Linux without a display, run it as `xvfb-run -a npm run test:integration`. `ONLY=Replace` runs the tests whose names match, and `VSCODE_VERSION=1.90.0` picks a version.
- Neither suite calls `api.p3n.si`.

## Screenshots

`node dev/shots.js` installs the packaged `.vsix` into a fresh VS Code profile and drives the window over the DevTools protocol, like a user would:
1. it selects a paragraph, runs Check for AI from the right-click menu, and switches the theme;
2. it runs Rewrite from the command palette, clicks Show changes and Replace selection, and presses Ctrl+Z.

The shots go to `dev/out/shots/`. This run uses the live API: 2 of the free hourly calls. `MOCK=1 node dev/shots.js` loads this folder as a development extension against canned answers instead, with no calls. `SMOKE=1 node dev/shots.js` only checks that the installed `.vsix` loads: the right-click items and the view, with no calls.

## Package

`npm run package` writes `p3n-vscode-<version>.vsix`. CI builds it on every push too; it's the `vsix` artifact of the run.

## Release

1. Raise `version` in package.json and add a CHANGELOG entry.
2. Package and test the `.vsix`: the unit and integration tests, then `SMOKE=1 node dev/shots.js` (or `node dev/shots.js` when the view changed) in a real VS Code.
3. Tag the commit `v<version>` and push the tag.
4. Make a GitHub release from the tag, with the CHANGELOG entry and the tested `.vsix` attached.

Publishing to the stores is done by hand with the same `.vsix`; see [store/publishing.md](store/publishing.md).
