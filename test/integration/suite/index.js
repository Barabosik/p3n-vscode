// Mocha inside VS Code's extension host: runs every *.test.js next to this file. ONLY=<substring> runs some.
const path = require('node:path');
const fs = require('node:fs');
const Mocha = require('mocha');

function run() {
  const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 20_000, grep: process.env.ONLY || undefined });
  for (const f of fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).sort()) mocha.addFile(path.join(__dirname, f));
  return new Promise((resolve, reject) => {
    mocha.run((failures) => (failures ? reject(new Error(`${failures} integration tests failed.`)) : resolve()));
  });
}

module.exports = { run };
