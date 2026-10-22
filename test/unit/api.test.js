// The API client against a stubbed fetch: headers, errors, polling, cancel. No network.
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../../src/api');
const { FIXTURES } = require('../fixtures');
const { version } = require('../../package.json');

const realFetch = globalThis.fetch;
let calls;
// Each answer: { status, json, html, headers } or { throw }.
function stub(...answers) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, ...init, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined });
    const a = answers.length > 1 ? answers.shift() : answers[0];
    if (a.throw) throw a.throw;
    const body = a.html ?? (a.json === undefined ? '' : JSON.stringify(a.json));
    return new Response(body, { status: a.status ?? 200, headers: { 'Content-Type': a.html ? 'text/html' : 'application/json', ...a.headers } });
  };
}
test.afterEach(() => { globalThis.fetch = realFetch; });

test('names the client and sends the text, without a key', async () => {
  stub({ json: FIXTURES.detect, headers: { 'X-Free-Remaining': '7' } });
  const { run, free } = await api.runSkill('detect', 'Some text.');
  assert.equal(run.output.ai, 0.96);
  assert.equal(free, 7);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.p3n.si/v1/detect');
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].headers['X-P3N-Client'], `p3n-vscode/${version}`);
  assert.equal(calls[0].headers.Accept, 'application/json');
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.deepEqual(calls[0].body, { text: 'Some text.' });
});

test('a key goes in as a bearer token, options in the body', async () => {
  stub({ json: FIXTURES.humanize });
  await api.runSkill('humanize', 'Some text.', { key: 'p3n_abc', options: { fresh: true } });
  assert.equal(calls[0].headers.Authorization, 'Bearer p3n_abc');
  assert.deepEqual(calls[0].body, { text: 'Some text.', options: { fresh: true } });
  assert.equal(calls[0].url, 'https://api.p3n.si/v1/humanize');
});

test('the free limit: type, wait, remaining; a sign-up link off p3n.si is dropped', async () => {
  stub({ status: 429, headers: { 'X-Free-Remaining': '0' }, json: { error: { type: 'free_limit', message: 'Free calls are used up.', signup_url: 'javascript:alert(1)', retry_after_seconds: 600 } } });
  await assert.rejects(api.runSkill('detect', 'x'), (e) => {
    assert.equal(e.type, 'free_limit');
    assert.equal(e.status, 429);
    assert.equal(e.retryAfter, 600);
    assert.equal(e.free, 0);
    assert.equal(e.signupUrl, null);
    return true;
  });
  stub({ status: 429, json: { error: { type: 'free_limit', signup_url: 'https://p3n.si/register?from=limit' } } });
  await assert.rejects(api.runSkill('detect', 'x'), (e) => e.signupUrl === 'https://p3n.si/register?from=limit');
});

test('an HTML error page becomes "p3n answered 502"', async () => {
  stub({ status: 502, html: '<!doctype html><title>502</title>Bad gateway' });
  await assert.rejects(api.runSkill('detect', 'x'), { type: 'upstream_error', message: 'p3n answered 502.' });
});

test('statuses without an error type get one', async () => {
  stub({ status: 401, json: {} });
  await assert.rejects(api.me('p3n_bad'), { type: 'unauthorized' });
  stub({ status: 402, json: { message: 'Low balance.' } });
  await assert.rejects(api.runSkill('detect', 'x'), { type: 'insufficient_credit', message: 'Low balance.' });
});

test("no connection: a message, not a stack", async () => {
  stub({ throw: new TypeError('fetch failed') });
  await assert.rejects(api.runSkill('detect', 'x'), { type: 'network', message: "Can't reach p3n. Check your connection and try again." });
});

test('a long text is polled until it finishes, through a connection blip', async () => {
  stub(
    { status: 202, json: { id: 'r1', status: 'queued' } },
    { json: { id: 'r1', status: 'running' } },
    { throw: new TypeError('fetch failed') },
    { json: { ...FIXTURES.detect, id: 'r1' } },
  );
  const { run } = await api.runSkill('detect', 'x', { key: 'p3n_k', pollMs: 1 });
  assert.equal(run.output.ai, 0.96);
  assert.deepEqual(calls.map((c) => c.url.replace('https://api.p3n.si', '')), ['/v1/detect', '/v1/runs/r1', '/v1/runs/r1', '/v1/runs/r1']);
  assert.ok(calls.every((c) => c.headers.Authorization === 'Bearer p3n_k' && c.headers['X-P3N-Client']));
});

test('a failed run: its error, or that it was not charged', async () => {
  stub({ json: { ...FIXTURES.humanize, status: 'failed', output: null, error: 'The model provider failed. You were not charged.' } });
  await assert.rejects(api.runSkill('humanize', 'x'), { type: 'run_failed', message: 'The model provider failed. You were not charged.' });
  stub({ json: { ...FIXTURES.humanize, status: 'failed', output: null, error: null } });
  await assert.rejects(api.runSkill('humanize', 'x'), { message: 'The run failed. You were not charged. Try again.' });
});

test('still running after the polls: may still be charged', async () => {
  stub({ status: 202, json: { id: 'r2', status: 'running' } });
  await assert.rejects(api.runSkill('detect', 'x', { pollMs: 0 }), { type: 'still_running' });
  assert.equal(calls.length, 151);
});

test('cancel stops the call and the polling', async () => {
  stub({ status: 202, json: { id: 'r3', status: 'queued' } });
  const c = new AbortController();
  const p = api.runSkill('detect', 'x', { signal: c.signal, pollMs: 50 });
  setTimeout(() => c.abort(), 10);
  await assert.rejects(p, { name: 'AbortError' });
  assert.equal(calls.length, 1);
});

test("Rewrite's word count is the API's: runs of A to Z, ' and -", () => {
  assert.equal(api.MIN_REWRITE_WORDS, 8);
  assert.equal(api.rewriteWords("It's a well-known fact."), 4);
  // Numbers aren't words, and a letter outside A to Z splits one (the API counts the same way).
  assert.equal(api.rewriteWords('Q3 2026: 4.2M, up 12%'), 3);
  assert.equal(api.rewriteWords('Tivolška'), 2);
  assert.equal(api.rewriteWords(''), 0);
  assert.equal(api.rewriteWords(undefined), 0);
});

test('the base URL can point at a stand-in API (tests)', async () => {
  stub({ json: FIXTURES.me });
  api.setBase('http://127.0.0.1:9/');
  try {
    assert.deepEqual(await api.me('p3n_k'), FIXTURES.me);
    assert.equal(calls[0].url, 'http://127.0.0.1:9/v1/me');
  } finally {
    api.setBase('https://api.p3n.si');
  }
});
