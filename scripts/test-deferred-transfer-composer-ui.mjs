// Actual React composer in an isolated Chromium mobile context. All actions
// are mocked and every network request is blocked. No player account is used.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const [modulePath, executablePath] = process.argv.slice(2);
assert(modulePath && executablePath, 'Supply playwright-core module and Chromium executable paths');
const { chromium } = await import(pathToFileURL(modulePath).href);
const bundle = await build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {DirectTransferOfferComposer} from '@/components/game/direct-transfer-offer-composer';
    const root=createRoot(document.getElementById('root'));
    const base={riderId:'00000000-0000-4000-8000-000000000100',salaryPerSeason:7000,
      availableBudget:25000,currency:'EUR',canMakeCashOffer:true,canMakeTradeOffer:true,
      nextSeason:{gameYear:5,salaryPerSeason:8000,canMakeCashOffer:true,canMakeTradeOffer:true,blockedReason:null}};
    let version=0;
    window.mountComposer=props=>root.render(<DirectTransferOfferComposer key={++version} {...base} {...props}/>);
    window.unmountComposer=()=>root.unmount();
  ` },
  plugins: [{ name: 'offline-actions', setup(b) {
    b.onResolve({ filter: /^@\/app\/jeu\/transferts\/actions$/ }, () => ({ path: 'actions', namespace: 'qa' }));
    b.onLoad({ filter: /.*/, namespace: 'qa' }, () => ({ contents: `
      export const loadDirectTransferTradeCandidatesAction=timing=>window.qaLoad(timing);
      export const submitDirectTransferOfferAction=data=>window.qaSubmit(data);
    ` }));
  } }],
  bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
});

const browser = await chromium.launch({ executablePath, headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  let networkCalls = 0;
  await context.route('**/*', route => { networkCalls++; return route.abort(); });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<div id="root"></div>');
  await page.evaluate(() => {
    window.qaSubmissions = [];
    window.qaLoads = [];
    window.qaSubmit = async data => { window.qaSubmissions.push(Object.fromEntries(data)); };
    window.qaLoad = async timing => {
      window.qaLoads.push(timing);
      return { candidates: [{ id: timing === 'next_season' ? 'future-rider' : 'current-rider', firstName: 'Ana',
        lastName: 'Martin', currentSalary: 6000, salaryPerSeason: 7000 }], error: null };
    };
  });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const tick = () => page.waitForTimeout(40);
  const mount = async (props = {}) => { await page.evaluate(value => window.mountComposer(value), props); await tick(); };
  const timing = page.locator('[name="timing"]');
  const amount = page.locator('[name="amount"]');
  const offered = page.locator('[name="offeredRiderId"]');
  const submit = page.getByRole('button', { name: 'Transmettre l’offre' });
  const load = page.getByRole('button', { name: 'Ajouter un coureur en échange' });
  const submissions = () => page.evaluate(() => window.qaSubmissions);

  await mount();
  assert.equal(await timing.inputValue(), 'immediate', 'existing offers retain the immediate default');
  assert.deepEqual(await page.evaluate(() => window.qaLoads), [], 'no candidate request on initial render');
  await timing.selectOption('next_season');
  assert.match(await page.locator('form').textContent(), /bloquée/);
  assert.doesNotMatch(await page.locator('form').textContent(), /payée à l’acceptation/);
  assert.doesNotMatch(await page.locator('form').textContent(), /immédiatement désinscrit/);
  assert.equal(await page.locator('form').getAttribute('data-financial-extra-expense'), '0');
  assert.equal((await submissions()).length, 0, 'changing the effective season never submits');
  await amount.fill('1200');
  await submit.click(); await tick();
  assert.equal((await submissions())[0].timing, 'next_season');
  assert.equal((await submissions())[0].amount, '1200');
  assert.equal((await submissions())[0].offeredRiderId, undefined, 'cash offer remains cash-only');

  await mount();
  await timing.selectOption('next_season');
  await load.click(); await tick();
  assert.deepEqual(await page.evaluate(() => window.qaLoads), ['next_season']);
  await offered.selectOption('future-rider');
  await amount.fill('0');
  assert.equal(await amount.getAttribute('min'), '0');
  assert.equal(await submit.isEnabled(), true);
  await submit.click(); await tick();
  assert.equal((await submissions())[1].timing, 'next_season');
  assert.equal((await submissions())[1].offeredRiderId, 'future-rider');
  assert.equal((await submissions())[1].amount, '0');
  await timing.selectOption('immediate'); await tick();
  assert.equal(await offered.count(), 0, 'switching timing discards an incompatible selected counterpart');
  await load.click(); await tick();
  assert.deepEqual(await page.evaluate(() => window.qaLoads), ['next_season', 'immediate']);
  assert.equal(await offered.inputValue(), '');
  assert.equal(await offered.locator('option[value="future-rider"]').count(), 0);
  assert.match(await page.locator('form').textContent(), /immédiatement désinscrit/);
  await timing.selectOption('next_season'); await tick();
  assert.equal(await offered.inputValue(), '');
  assert.deepEqual(await page.evaluate(() => window.qaLoads), ['next_season', 'immediate'], 'timing-specific candidate batches are reused');

  await mount({ canMakeCashOffer: false, canMakeTradeOffer: false });
  assert.equal(await timing.inputValue(), 'next_season', 'a full current roster does not hide the future option');
  assert.equal(await submit.isEnabled(), true);
  await mount({ availableBudget: -1000, canMakeCashOffer: false, nextSeason: {
    gameYear: 5, salaryPerSeason: 8000, canMakeCashOffer: false, canMakeTradeOffer: true, blockedReason: null,
  } });
  await timing.selectOption('next_season');
  await load.click(); await tick();
  await offered.selectOption('future-rider');
  await amount.fill('0');
  assert.equal(await amount.evaluate(input => input.validity.valid), true, 'a pure exchange remains valid with no free cash');
  await submit.click(); await tick();
  assert.equal((await submissions()).length, 3);
  assert.equal((await submissions())[2].amount, '0');
  assert.equal((await submissions())[2].timing, 'next_season');

  await mount({ nextSeason: null });
  assert.equal(await timing.inputValue(), 'immediate');
  assert.equal(await page.locator('select[name="timing"]').count(), 0);
  assert.deepEqual(errors, []);
  assert.equal(networkCalls, 0);
  await page.evaluate(() => window.unmountComposer());
  console.log(JSON.stringify({ chromiumMobileComposer: 'passed', immediateDefault: true, deferredCashAndTrade: true,
    timingScopedCandidates: true, fullCurrentRoster: true, debtPureExchange: true, explicitSubmissions: 3, networkCalls }));
  await context.close();
} finally {
  await browser.close();
}
