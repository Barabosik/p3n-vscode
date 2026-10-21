# Publishing

Both stores are free, and neither reviews a new extension by hand. An automated scan runs on each upload, and the
extension is public a few minutes later. Upload the same .vsix to both: the one attached to the GitHub release
(https://github.com/Barabosik/p3n-vscode/releases/latest), which is the one that was tested in VS Code.

The publisher ID must match `"publisher"` in package.json (`nikita-andreiev`). A different ID means changing
package.json and building again.

## VS Code Marketplace

1. Open https://marketplace.visualstudio.com/manage and sign in with a Microsoft account. A personal one works.
2. Click **Create publisher**:
   - **ID** `nikita-andreiev`. It can't be changed later.
   - **Name** `Nikita Andreiev`.
   - Website https://nikita-andreiev.com, plus the GitHub link if you like.
3. Click **New extension** › **Visual Studio Code**, and upload `p3n-vscode-0.1.0.vsix`.
4. Wait until the status changes from "Verifying" to the version number. It's then live at
   https://marketplace.visualstudio.com/items?itemName=nikita-andreiev.p3n-vscode.

Updates: raise `version` in package.json, add a CHANGELOG entry, build, then on the manage page click **…** › **Update**
and upload the new .vsix.

Not needed: an Azure DevOps organisation or a personal access token. Those are only for publishing from the command
line or CI. Since 2026 a new Azure DevOps organisation needs an Azure subscription, and global tokens stop working on
2026-12-01.

## Open VSX (VSCodium, Cursor, Windsurf, Gitpod)

1. Open https://open-vsx.org and log in with GitHub (Barabosik).
2. Create an Eclipse account at https://accounts.eclipse.org/user/register. Put **Barabosik** in the GitHub username
   field.
3. On open-vsx.org, open your avatar › **Settings**. Log in with the Eclipse account, click **Show Publisher Agreement**,
   then **Agree**.
4. Under **Access Tokens**, generate a token. It's shown once, so keep it in your password manager. Never paste it
   into a chat, the repo or CI logs.
5. In this folder, run:
   ```bash
   npx ovsx create-namespace nikita-andreiev -p <token>
   npx ovsx publish p3n-vscode-0.1.0.vsix -p <token>
   ```
6. It's live at https://open-vsx.org/extension/nikita-andreiev/p3n-vscode.
7. Optional: claim the namespace, so the page doesn't say "not a verified publisher".
   - Open an issue with the namespace template at https://github.com/EclipseFdn/open-vsx.org/issues.
   - As evidence, give this repo's commits by Barabosik and the Marketplace publisher page.

## After both are live

- README › Install: replace "coming soon" with the two store links, and keep "Install from VSIX" for people who
  can't use the stores.
- The p3n install page (https://nikita-andreiev.com/p3n/) and the portfolio can link to it. That page lives in the
  website repo.
