# Store listing

The VS Code Marketplace and Open VSX build the listing from the package itself. There's no separate form. The page is
`README.md`, and the card is `package.json`. Edit those, then upload a new .vsix.

| Field | Value | Where |
| --- | --- | --- |
| Name (card title) | p3n | `displayName` |
| ID | `nikita-andreiev.p3n-vscode` | `publisher`.`name`; can't change once published |
| Short description | Select text and see if it reads as AI-written, or rewrite it in place. Free without an account. | `description` |
| Icon | `images/icon.png`, 128×128 PNG (the p3n pen on a light tile) | `icon` |
| Banner | `#fbfaf7`, light | `galleryBanner` |
| Category | Other | `categories` |
| Tags | ai detector, ai writing, ai text, humanize, rewrite, writing, prose, markdown, p3n | `keywords` (30 at most) |
| Pricing | Free | `pricing` |
| Links | p3n.si, GitHub repo, issues (also the Q&A link) | `homepage`, `repository`, `bugs`, `qna` |
| Licence | MIT | `license`, `LICENSE` |
| Page | README: what it does, use, free or with a key, privacy, install, known gaps, open source | `README.md` |
| Screenshots | `images/check-light.png`, `images/rewrite-dark.png` (1920×1200, from `dev/shots.js`) | README; vsce turns the relative links into GitHub URLs |
| Changelog tab | `CHANGELOG.md` | |

Both stores show the README's images from GitHub, so the repo must be public before the first upload.

## Short copy, for posts and the p3n install page

**p3n for VS Code.** Select text in the editor and see if it reads as AI-written: a score, a reason, and the sentences
that give it away. Or rewrite it, and put the rewrite back with one click and one undo step. Free for 10 calls an hour
without an account. Open source, no telemetry.

## Screenshots

From the live API with the installed .vsix (`node dev/shots.js`):
- `check-light.png`: Check for AI on a paragraph, Light Modern theme.
- `check-dark.png`: the same, Dark Modern.
- `rewrite-dark.png`, `rewrite-light.png`: Rewrite, before Replace.
- `replaced-light.png`: after Replace selection, the rewrite selected in the editor.
- `menu.png`: p3n's two commands in the editor's right-click menu.

The README uses `check-light.png` and `rewrite-dark.png`, copied to `images/`.
