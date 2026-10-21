// Downloads VS Code (stable, or VSCODE_VERSION), and runs the integration suite inside it with the extension
// loaded from this folder. The API is a stand-in on localhost (suite/mock.js); nothing goes to api.p3n.si.
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const { runTests } = require('@vscode/test-electron');

const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer().listen(0, '127.0.0.1', () => {
    const { port } = srv.address();
    srv.close(() => resolve(port));
  }).on('error', reject);
});

(async () => {
  const root = path.resolve(__dirname, '../..');
  const port = await freePort();
  // A fresh profile each run: no other extensions, no saved key, no restored views.
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'p3n-vscode-test-'));
  const workspace = path.join(userData, 'workspace');
  fs.cpSync(path.join(__dirname, 'fixtures'), workspace, { recursive: true });
  try {
    await runTests({
      version: process.env.VSCODE_VERSION || 'stable',
      extensionDevelopmentPath: root,
      extensionTestsPath: path.join(__dirname, 'suite', 'index.js'),
      launchArgs: [workspace, '--disable-extensions', '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes', `--user-data-dir=${path.join(userData, 'profile')}`],
      extensionTestsEnv: {
        P3N_API_URL: `http://127.0.0.1:${port}`,
        P3N_MOCK_PORT: String(port),
        P3N_TEST_PROFILE: path.join(userData, 'profile'),
        ...(process.env.ONLY ? { ONLY: process.env.ONLY } : {}),
        ...(process.env.SHOTS ? { SHOTS: process.env.SHOTS } : {}),
      },
    });
  } catch (e) {
    console.error('Integration tests failed:', e.message ?? e);
    process.exitCode = 1;
  } finally {
    fs.rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  }
})();
