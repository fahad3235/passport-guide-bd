// Passport Guide BD headless-Chrome smoke test (raw CDP, headless_shell).
// Run: node smoke/smoke.mjs
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file://' + path.resolve(DIR, '..', 'index.html');
const CHROME = process.env.HEADLESS_SHELL ||
  (process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell');
const PORT = 9230;
const TAKA = '\u09f3';

const results = [];
function check(name, cond, extra) {
  results.push([name, !!cond]);
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (extra !== undefined ? ' :: ' + extra : ''));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if (await fn()) return true; } catch (e) { /* retry */ }
    await sleep(200);
  }
  throw new Error('timeout waiting for: ' + label);
}

async function main() {
  const child = spawn(CHROME, [
    '--headless', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--remote-debugging-address=127.0.0.1',
    'about:blank',
  ], { stdio: 'ignore' });
  try {
    let version = null;
    await waitFor(async () => {
      const res = await fetch('http://127.0.0.1:' + PORT + '/json/version');
      if (!res.ok) return false;
      version = await res.json();
      return true;
    }, 20000, 'debugger port');
    const ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0;
    const pending = new Map();
    const consoleErrors = [];
    const exceptions = [];
    const onMsg = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error))); else res(msg.result);
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        exceptions.push(msg.params.exceptionDetails.exception?.description || 'exception');
      }
    };
    ws.onmessage = onMsg;
    const send = (method, params) => new Promise((res, rej) => {
      const mid = ++id;
      pending.set(mid, { res, rej });
      ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
    });
    const target = await (await fetch('http://127.0.0.1:' + PORT + '/json/new?about:blank', { method: 'PUT' })).json();
    const tws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { tws.onopen = res; tws.onerror = rej; });
    const tpending = new Map();
    let tid = 0;
    tws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && tpending.has(msg.id)) {
        const { res, rej } = tpending.get(msg.id);
        tpending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error))); else res(msg.result);
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        exceptions.push(msg.params.exceptionDetails.exception?.description || 'exception');
      }
    };
    const tsend = (method, params) => new Promise((res, rej) => {
      const mid = ++tid;
      tpending.set(mid, { res, rej });
      tws.send(JSON.stringify({ id: mid, method, params: params || {} }));
    });
    const teval = async (expr) => {
      const r = await tsend('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed');
      return r.result.value;
    };
    await tsend('Runtime.enable');
    await tsend('Page.enable');
    await tsend('Page.navigate', { url: PAGE });
    await waitFor(async () => (await teval('document.getElementById("fee-amount").textContent.length')) > 1, 10000, 'app renders');

    // 1. Initial render: title, 6 tabs, default fee 48/5/Regular = 4025.
    check('title correct', await teval('document.querySelector("h1").textContent') === 'Passport Guide BD');
    check('6 tabs render', (await teval('document.querySelectorAll("#tabs button").length')) === 6);
    check('default fee is 4,025', await teval('document.getElementById("fee-amount").textContent') === TAKA + '4,025');
    check('default delivery 15-21 days', await teval('document.getElementById("delivery-result").textContent') === '15-21 days');

    // 2. Calculator: change booklet/validity/speed, fee follows the DIP table.
    await teval(`[...document.querySelectorAll('#seg-pages button')].find(b => b.dataset.value === '64').click();`);
    await sleep(200);
    check('64 pages regular 5y = 6,325', await teval('document.getElementById("fee-amount").textContent') === TAKA + '6,325');
    await teval(`[...document.querySelectorAll('#seg-years button')].find(b => b.dataset.value === '10').click();`);
    await sleep(200);
    check('64 pages 10y regular = 8,050', await teval('document.getElementById("fee-amount").textContent') === TAKA + '8,050');
    await teval(`[...document.querySelectorAll('#seg-speed button')].find(b => b.dataset.value === 'super').click();`);
    await sleep(200);
    check('64/10 super = 13,800 + 2 days', (await teval('document.getElementById("fee-amount").textContent')) === TAKA + '13,800'
      && (await teval('document.getElementById("delivery-result").textContent')) === '2 days');
    await teval(`[...document.querySelectorAll('#seg-speed button')].find(b => b.dataset.value === 'express').click();`);
    await sleep(200);
    check('64/10 express = 10,350 + 7-10 days', (await teval('document.getElementById("fee-amount").textContent')) === TAKA + '10,350'
      && (await teval('document.getElementById("delivery-result").textContent')) === '7-10 days');

    // 3. Age rule: 16yo + 10y shows warning; 30yo hides it.
    await teval(`document.getElementById('age-input').value = '16'; document.getElementById('age-input').dispatchEvent(new Event('input', {bubbles: true}));`);
    await sleep(200);
    check('age 16 + 10y shows warning', await teval('!document.getElementById("age-warn").hidden'));
    await teval(`document.getElementById('age-input').value = '30'; document.getElementById('age-input').dispatchEvent(new Event('input', {bubbles: true}));`);
    await sleep(200);
    check('age 30 hides warning', await teval('document.getElementById("age-warn").hidden'));
    await teval(`document.getElementById('age-input').value = ''; document.getElementById('age-input').dispatchEvent(new Event('input', {bubbles: true}));`);
    await sleep(200);

    // 4. Chart: 12 rows; clicking a row loads it into the calculator.
    await teval(`document.getElementById('tab-chart').click();`);
    await sleep(300);
    check('chart has 12 rows', (await teval('document.querySelectorAll("#chart-body tr").length')) === 12);
    check('chart row shows 13,800', await teval('document.getElementById("chart-body").textContent.includes("13,800")'));
    await teval(`[...document.querySelectorAll('#chart-body tr')].find(tr => tr.textContent.includes('13,800')).click();`);
    await sleep(300);
    check('row click switches to calc tab', await teval('document.getElementById("panel-calc").classList.contains("active")'));
    check('row click loads 13,800 fee', await teval('document.getElementById("fee-amount").textContent') === TAKA + '13,800');

    // 5. Checklist: New = 6 items, tick one, progress 1/6; Lost = 5 items.
    await teval(`document.getElementById('tab-check').click();`);
    await sleep(300);
    check('New checklist has 6 items', (await teval('document.querySelectorAll("#checklist-list .check-item").length')) === 6);
    await teval(`document.querySelector('#checklist-list input[type="checkbox"]').click();`);
    await sleep(300);
    check('progress shows 1/6 done', await teval('document.getElementById("check-progress").textContent.includes("1/6")'));
    await teval(`[...document.querySelectorAll('#check-types button')].find(b => b.dataset.value === 'lost').click();`);
    await sleep(300);
    check('Lost checklist has 5 items', (await teval('document.querySelectorAll("#checklist-list .check-item").length')) === 5);
    check('Lost list mentions GD', await teval('document.getElementById("checklist-list").textContent.includes("General Diary")'));

    // 6. Tracker: add valid + expired passports; validation blocks empty label.
    await teval(`document.getElementById('tab-track').click();`);
    await sleep(300);
    check('tracker empty state visible', await teval('!document.getElementById("tracker-empty").hidden'));
    await teval(`document.getElementById('p-label').value = ''; document.getElementById('p-expiry').value = '2031-01-01';
      document.querySelector('#add-passport button[type="submit"]').click();`);
    await sleep(300);
    check('empty label shows inline error', await teval('!document.getElementById("err-label").hidden'));
    await teval(`document.getElementById('p-label').value = 'Mine'; document.getElementById('p-expiry').value = '2031-01-01';
      document.querySelector('#add-passport button[type="submit"]').click();`);
    await sleep(300);
    check('valid passport added with Valid badge', (await teval('document.querySelectorAll(".passport-card").length')) === 1
      && await teval('document.querySelector(".passport-card .badge").textContent') === 'Valid');
    await teval(`document.getElementById('p-label').value = 'Old'; document.getElementById('p-expiry').value = '2020-01-01';
      document.querySelector('#add-passport button[type="submit"]').click();`);
    await sleep(300);
    check('expired passport shows Expired badge', (await teval('document.querySelectorAll(".passport-card").length')) === 2
      && await teval('[...document.querySelectorAll(".passport-card .badge")].some(b => b.textContent === "Expired")'));
    await teval(`document.getElementById('p-label').value = 'Soon'; document.getElementById('p-expiry').value = '2027-03-01';
      document.querySelector('#add-passport button[type="submit"]').click();`);
    await sleep(300);
    check('under-180-days passport shows Renew soon badge', await teval('[...document.querySelectorAll(".passport-card .badge")].some(b => b.textContent === "Renew soon")'));

    // 7. Steps: 7 steps + 3 notes render.
    await teval(`document.getElementById('tab-steps').click();`);
    await sleep(300);
    check('7 steps render', (await teval('document.querySelectorAll("#steps-list li").length')) === 7);
    check('3 good-to-know notes render', (await teval('document.querySelectorAll("#notes-list li").length')) === 3);
    check('steps mention epassport.gov.bd', await teval('document.getElementById("steps-list").textContent.includes("epassport.gov.bd")'));

    // 8. Bangla toggle: title + Bengali digits in fee.
    await teval(`document.getElementById('lang-toggle').click();`);
    await sleep(300);
    check('Bangla title shown', await teval('document.querySelector("h1").textContent') !== 'Passport Guide BD');
    check('Bengali digits in fee', await teval('/[\u09e6-\u09ef]/.test(document.getElementById("fee-amount").textContent)'));
    await teval(`document.getElementById('lang-toggle').click();`);
    await sleep(200);
    check('toggle back to English title', await teval('document.querySelector("h1").textContent') === 'Passport Guide BD');

    // 9. Persistence across reload: checklist tick + language + passports survive.
    await teval(`document.getElementById('lang-toggle').click();`);
    await sleep(200);
    await tsend('Page.navigate', { url: PAGE });
    await waitFor(async () => (await teval('document.getElementById("fee-amount").textContent.length')) > 1, 10000, 'app after reload');
    await sleep(300);
    check('language persists after reload', await teval('document.querySelector("h1").textContent') !== 'Passport Guide BD');
    check('passports persist after reload', (await teval('document.querySelectorAll(".passport-card").length')) === 3);
    await teval(`document.getElementById('tab-check').click();`);
    await sleep(300);
    await teval(`[...document.querySelectorAll('#check-types button')].find(b => b.dataset.value === 'new').click();`);
    await sleep(300);
    check('checklist tick persists after reload', await teval('document.querySelector("#checklist-list input[type=\\"checkbox\\"]").checked') === true);
    await teval(`document.getElementById('lang-toggle').click();`);
    await sleep(200);

    // 10. Data tab: typed-DELETE erase clears passports.
    await teval(`document.getElementById('tab-data').click();`);
    await sleep(300);
    await teval(`document.getElementById('erase-input').value = 'DELETE'; document.getElementById('erase-btn').click();`);
    await sleep(300);
    check('erase clears passports', (await teval('document.querySelectorAll(".passport-card").length')) === 0);
    await teval(`document.getElementById('tab-track').click();`);
    await sleep(300);
    check('tracker empty again after erase', await teval('!document.getElementById("tracker-empty").hidden'));

    // 11. Mobile 390px: no horizontal overflow on calc + chart + tracker tabs.
    await tsend('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await sleep(500);
    check('no overflow at 390px (calc)', await teval('document.documentElement.scrollWidth <= 391'));
    await teval(`document.getElementById('tab-chart').click();`);
    await sleep(300);
    check('no overflow at 390px (chart)', await teval('document.documentElement.scrollWidth <= 391'));
    await teval(`document.getElementById('tab-track').click();`);
    await sleep(300);
    check('no overflow at 390px (tracker)', await teval('document.documentElement.scrollWidth <= 391'));

    // 12. No console errors / exceptions.
    check('zero console errors', consoleErrors.length === 0, consoleErrors.join(' | '));
    check('zero page exceptions', exceptions.length === 0, exceptions.join(' | '));

    tws.close(); ws.close();
  } finally {
    child.kill();
  }
  const failed = results.filter((r) => !r[1]).length;
  console.log(failed === 0 ? 'SMOKE PASS: ' + results.length + '/' + results.length : 'SMOKE FAIL: ' + failed + ' failures');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('SMOKE ERROR:', e.message); process.exit(1); });
