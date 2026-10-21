// The p3n view's page: draws the state the extension posts, and posts the clicks back. API text only ever
// becomes text nodes, never HTML.
(() => {
  const vscode = acquireVsCodeApi();
  const $ = (s) => document.querySelector(s);
  const els = {
    account: $('#account'), check: $('#check'), rewrite: $('#rewrite'), source: $('#source'), intro: $('#intro'),
    busy: $('#busy'), busyText: $('#busy-text'), cancel: $('#cancel'), result: $('#result'), quota: $('#quota'),
  };
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  let state = null;
  let drawnSeq = -1;
  let timer = null;

  // Tiny DOM builder. Strings become text nodes.
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v == null) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k.startsWith('--')) el.style.setProperty(k, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    el.append(...kids.flat().filter((c) => c !== null && c !== undefined && c !== false));
    return el;
  }
  const send = (msg) => vscode.postMessage(msg);

  // A check mark that draws itself, for Copied and Replaced.
  function checkMark() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    const path = document.createElementNS(ns, 'path');
    for (const [k, v] of Object.entries({ viewBox: '0 0 16 16', class: 'tick', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
    for (const [k, v] of Object.entries({ d: 'M3 8.5l3.2 3L13 4.5', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) path.setAttribute(k, v);
    svg.append(path);
    return svg;
  }

  // ---- motion ----------------------------------------------------------------------------

  // The score runs from where the text was to where it is now (0 for a check, the score before for a rewrite), and
  // the number and the bar take the colour of each band they pass through. The markup already holds the end state,
  // so reduced motion shows the right result.
  const tone = (x) => (x >= 70 ? 'ai' : x >= 40 ? 'mid' : 'human');
  function runScore(root) {
    const score = root.querySelector('[data-to]');
    const num = score?.querySelector('.num');
    if (!num) return;
    const pctEl = score.querySelector('.pct');
    const bar = root.querySelector('.meter i');
    const from = Number(score.dataset.from);
    const to = Number(score.dataset.to);
    if (calm.matches || from === to) return;
    const draw = (v, t = tone(v)) => {
      num.textContent = `${Math.round(v)}%`;
      pctEl.classList.remove('t-ai', 't-mid', 't-human');
      pctEl.classList.add(`t-${t}`);
      if (bar) bar.className = `b-${t}`;
    };
    const scale = (v) => { if (bar) bar.style.transform = `scaleX(${Math.max(3, v) / Math.max(3, to)})`; };
    const t0 = performance.now() + 120;
    const ms = 800;
    draw(from);
    scale(from);
    const step = (now) => {
      if (!num.isConnected) return;
      const p = Math.min(1, Math.max(0, (now - t0) / ms));
      const v = from + (to - from) * (1 - (1 - p) ** 4);
      if (p < 1) {
        draw(v);
        scale(v);
        requestAnimationFrame(step);
      } else {
        draw(to, score.dataset.tone);
        if (bar) bar.style.transform = '';
      }
    };
    requestAnimationFrame(step);
  }

  // ---- results ---------------------------------------------------------------------------

  // The big number: animated for the eye, stated once for screen readers (the result is a live region).
  const scoreNum = (p) => [h('span', { class: 'num', 'aria-hidden': 'true' }, `${p}%`), h('span', { class: 'sr' }, `${p}%`)];
  const meter = (s) => h('div', { class: 'meter' }, h('i', { class: `b-${s.tone}`, '--w': `${Math.max(3, s.to)}%` }));

  function scoreBlock(s) {
    return h('div', { class: 'score', 'data-from': s.from, 'data-to': s.to, 'data-tone': s.tone },
      s.sub ? h('div', {}, h('p', { class: 'label' }, s.label), h('p', { class: 'small muted' }, s.sub)) : h('p', { class: 'label' }, s.label),
      h('p', { class: `pct t-${s.tone}`, title: s.title || null },
        s.showFrom ? h('span', { class: 'from' }, `${s.from}% → `) : null,
        scoreNum(s.to), h('small', {}, s.unit)));
  }

  const quotes = (title, items, hit) => h('div', {}, h('h3', {}, title),
    h('ul', { class: 'quotes' }, items.map((q, j) => h('li', { class: hit ? 'hit' : null, '--j': String(j) }, q.why ? h('span', { class: 'why' }, q.why) : null, h('q', {}, q.text)))));

  function detect(m) {
    return [
      scoreBlock(m.score),
      meter(m.score),
      m.verdict ? h('p', {}, m.verdict) : null,
      m.confidence ? h('p', { class: 'small muted' }, m.confidence) : null,
      m.sentences.length ? quotes('Sentences that read as AI', m.sentences, true) : null,
      m.hits.length ? quotes('Pattern hits', m.hits, false) : null,
      h('p', { class: 'small muted' }, m.foot),
    ];
  }

  function humanize(m) {
    const buttons = [];
    const r = m.replace;
    if (r?.state === 'done') {
      buttons.push(h('button', { type: 'button', class: 'btn ok', disabled: true }, checkMark(), 'Replaced'));
    } else if (r) {
      buttons.push(h('button', { type: 'button', class: 'btn primary', id: 'replace', onclick: () => send({ type: 'replace' }) }, 'Replace selection'));
    }
    const copy = h('button', { type: 'button', class: r ? 'btn secondary' : 'btn primary', id: 'copy' }, 'Copy');
    copy.addEventListener('click', () => {
      send({ type: 'copy' });
      copy.replaceChildren(checkMark(), 'Copied');
      clearTimeout(copy.reset);
      copy.reset = setTimeout(() => copy.replaceChildren('Copy'), 1500);
    });
    buttons.push(copy, h('button', { type: 'button', class: 'link small push', onclick: () => send({ type: 'again' }) }, 'Try another rewrite'));
    return [
      scoreBlock(m.score),
      meter(m.score),
      h('div', { class: 'rewrite' }, m.rewrite),
      h('div', { class: 'row' }, buttons),
      r?.message ? h('p', { class: `note small ${r.state === 'done' ? 'ok' : 'warn'}`, role: 'status' }, r.message) : null,
      ...m.notes.map((n) => h('p', { class: n.kind === 'warn' ? 'note warn small' : 'small muted' }, n.text)),
      h('p', { class: 'small muted' }, m.foot),
    ];
  }

  function error(m) {
    return [h('div', { class: 'note error' },
      m.lines.map((l) => h('p', { class: l.small ? 'small' : null }, l.text)),
      m.actions.length ? h('div', { class: 'row' }, m.actions.map((a) => h('button', {
        type: 'button', class: a.primary ? 'btn primary' : 'btn secondary',
        onclick: () => send(a.open ? { type: 'open', url: a.open } : { type: 'command', id: a.command }),
      }, a.label))) : null)];
  }

  function drawResult(m, fresh) {
    if (!m) return els.result.replaceChildren();
    // A redraw of the same result (Replaced, Copied) keeps focus where it was.
    const focusId = document.activeElement?.id;
    const body = m.kind === 'detect' ? detect(m) : m.kind === 'humanize' ? humanize(m) : error(m);
    const box = h('div', { class: fresh ? 'result-in' : null }, body, m.meta ? h('p', { class: 'small muted' }, m.meta) : null);
    [...box.children].forEach((c, i) => c.style.setProperty('--i', String(i)));
    els.result.replaceChildren(box);
    if (fresh) runScore(box);
    else if (focusId) document.getElementById(focusId)?.focus();
    if (!fresh && m.replace?.state === 'done') box.querySelector('[role="status"]')?.focus?.();
  }

  // ---- busy --------------------------------------------------------------------------------

  function drawBusy(busy) {
    clearInterval(timer);
    els.busy.hidden = !busy;
    if (!busy) return;
    const t0 = Date.now();
    const what = busy.skill === 'detect' ? 'Checking' : 'Rewriting';
    const tick = () => {
      const s = Math.round((Date.now() - t0) / 1000);
      els.busyText.textContent = `${what}… ${s} s` + (busy.skill === 'humanize' && s > 8 ? ' (a rewrite takes up to a minute)' : '');
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  // ---- state -----------------------------------------------------------------------------

  function draw(next) {
    const prev = state;
    state = next;
    els.account.textContent = next.hasKey ? 'API key' : 'Add API key';
    els.quota.textContent = next.quota;
    els.check.disabled = !!next.busy;
    els.rewrite.disabled = !!next.busy;
    els.source.hidden = !next.source;
    els.source.textContent = next.source ? `${next.source.where} · ${next.source.chars.toLocaleString('en-US')} characters` : '';
    els.intro.hidden = !!(next.source || next.result || next.busy);
    if (!!prev?.busy !== !!next.busy || prev?.busy?.skill !== next.busy?.skill) drawBusy(next.busy);
    const fresh = next.seq !== drawnSeq;
    if (fresh || JSON.stringify(prev?.result) !== JSON.stringify(next.result)) drawResult(next.result, fresh && !!next.result);
    drawnSeq = next.seq;
    // The tests read what the view shows, and the theme it follows.
    if (next.test) {
      send({ type: 'rendered', text: document.body.innerText, theme: document.body.className, accent: getComputedStyle(document.querySelector('.wordmark span')).color });
    }
  }

  els.check.addEventListener('click', () => send({ type: 'run', skill: 'detect' }));
  els.rewrite.addEventListener('click', () => send({ type: 'run', skill: 'humanize' }));
  els.cancel.addEventListener('click', () => send({ type: 'cancel' }));
  els.account.addEventListener('click', () => send({ type: 'account' }));
  document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => send({ type: 'open', url: b.dataset.open })));
  window.addEventListener('message', (e) => { if (e.data?.type === 'state') draw(e.data.state); });
  send({ type: 'ready' });
})();
