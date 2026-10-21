// A stand-in for api.p3n.si on localhost. It answers with the canned runs, records every request, and takes
// queued answers for the error cases.
const http = require('node:http');
const { FIXTURES } = require('../../fixtures');

const mock = {
  requests: [], // { method, path, headers, body }
  queue: [], // next answers: { status, body } or { html } or { delayMs }
  server: null,
  reset() { this.requests = []; this.queue = []; },
  calls(path) { return this.requests.filter((r) => !path || r.path === path); },
};

function answer(req, body) {
  const next = mock.queue.shift();
  if (next) return next;
  if (req.url === '/v1/me') {
    return req.headers.authorization === 'Bearer p3n_good'
      ? { body: FIXTURES.me }
      : { status: 401, body: { error: { type: 'unauthorized', message: 'Invalid API key.' } } };
  }
  const skill = req.url.replace('/v1/', '');
  if (FIXTURES[skill]) return { body: FIXTURES[skill], headers: { 'X-Free-Remaining': '9' } };
  return { status: 404, body: { error: { type: 'not_found', message: `No ${req.url}.` } } };
}

function start(port) {
  mock.server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : undefined;
      mock.requests.push({ method: req.method, path: req.url, headers: req.headers, body });
      const a = answer(req, body);
      const send = () => {
        if (res.destroyed) return;
        if (a.html) {
          res.writeHead(a.status ?? 502, { 'Content-Type': 'text/html' });
          return res.end(a.html);
        }
        res.writeHead(a.status ?? 200, { 'Content-Type': 'application/json', ...a.headers });
        res.end(JSON.stringify(a.body));
      };
      if (a.delayMs) setTimeout(send, a.delayMs);
      else send();
    });
  });
  return new Promise((resolve) => mock.server.listen(port, '127.0.0.1', resolve));
}

module.exports = { mock, start };
