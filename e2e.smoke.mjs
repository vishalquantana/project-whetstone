import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:5173/';
const SHOTS = '/tmp/whetstone-shots';
mkdirSync(SHOTS, { recursive: true });

const consoleErrors = [];
const pageErrors = [];
const steps = [];
let ctxLabel = 'boot';

function ok(name, extra = '') { steps.push({ step: name, status: 'PASS', extra }); }
function bad(name, err) { steps.push({ step: name, status: 'FAIL', error: String(err && err.message || err) }); }

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });

page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push({ where: ctxLabel, text: m.text() }); });
page.on('pageerror', (e) => pageErrors.push({ where: ctxLabel, text: String(e.message || e) }));

const nav = (name) => page.locator('nav.tabnav').getByRole('button', { name, exact: true });
const score = async () => {
  const t = await page.locator('.score-num').first().textContent();
  return parseInt((t || '0').trim(), 10) || 0;
};
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });

try {
  // ---- boot: landing gate ----
  ctxLabel = 'boot';
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // First-time visitor lands on the marketing page (no tab bar yet).
  await page.getByRole('button', { name: 'Start training' }).first().waitFor({ timeout: 8000 });
  const tabBarOnLanding = await page.locator('nav.tabnav').count();
  if (tabBarOnLanding === 0) ok('boot: landing shown first (no tab bar)');
  else bad('boot: tab bar leaked onto landing', `count=${tabBarOnLanding}`);
  await shot('00-landing');

  // Enter the app.
  await page.getByRole('button', { name: 'Start training' }).first().click();
  await page.locator('.score-num').first().waitFor({ timeout: 8000 });
  await shot('01-today-initial');
  const s0 = await score();
  ok('boot: Start training enters the app (Today renders)', `score=${s0}`);

  // Returning visitor (entered flag persisted) skips the landing on reload.
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.score-num').first().waitFor({ timeout: 8000 });
  const landingAfterReload = await page.getByRole('button', { name: 'Start training' }).count();
  if (landingAfterReload === 0) ok('boot: returning visitor skips the landing');
  else bad('boot: landing re-shown to returning visitor', `count=${landingAfterReload}`);

  // ============ SPAR ============
  ctxLabel = 'spar';
  try {
    await nav('Spar').click();
    await page.getByText("Today’s claim", { exact: false }).waitFor({ timeout: 6000 });
    await shot('02-spar-commit');
    await page.locator('textarea[aria-label="Your opening position"]').fill(
      'I disagree with the claim because the evidence is weak and selection effects fully explain the apparent productivity difference here.'
    );
    await page.getByRole('button', { name: 'Get sparring' }).click();
    await page.locator('textarea[aria-label="Your rebuttal"]').waitFor({ timeout: 8000 });
    await shot('03-spar-round1');
    for (let i = 0; i < 3; i++) {
      await page.locator('textarea[aria-label="Your rebuttal"]').fill(
        `Round ${i + 1}: here is my concrete rebuttal with a specific example and a clear mechanism that addresses the challenge directly.`
      );
      if (i < 2) {
        await page.getByRole('button', { name: 'Fire back' }).click();
        await page.waitForTimeout(400);
      } else {
        await page.getByRole('button', { name: 'Land final blow & get scored' }).click();
      }
    }
    await page.getByText('Weakest link', { exact: false }).waitFor({ timeout: 8000 });
    await shot('04-spar-verdict');
    await page.getByRole('button', { name: 'Bank the rep' }).click();
    await page.locator('.score-num').first().waitFor({ timeout: 6000 });
    const s1 = await score();
    if (s1 > s0) ok('spar: full flow + score updated', `score ${s0}->${s1}`);
    else bad('spar: score did not increase', `score stayed ${s1}`);
  } catch (e) { await shot('ERR-spar'); bad('spar flow', e); }

  // ============ READ & RETAIN ============
  ctxLabel = 'read-retain';
  const sBeforeRR = await score();
  try {
    await nav('Read').click();
    await page.getByRole('button', { name: 'Load the sample passage' }).waitFor({ timeout: 6000 });
    await shot('05-rr-paste');
    await page.getByRole('button', { name: 'Load the sample passage' }).click();
    await page.getByRole('button', { name: 'Redact & begin' }).click();
    await page.locator('#rr-answer').waitFor({ timeout: 8000 });
    await shot('06-rr-recall');
    await page.locator('#rr-answer').fill(
      'Effortful retrieval from memory strengthens the trace far more than passive re-reading, and spacing forces recall as forgetting begins (the testing effect).'
    );
    await page.getByRole('button', { name: 'Unlock the summary' }).click();
    await page.getByText('THE CLEAN SUMMARY', { exact: false }).waitFor({ timeout: 8000 });
    await shot('07-rr-revealed');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.locator('.score-num').first().waitFor({ timeout: 6000 });
    const s2 = await score();
    if (s2 > sBeforeRR) ok('read-retain: full flow + score updated', `score ${sBeforeRR}->${s2}`);
    else bad('read-retain: score did not increase', `stayed ${s2}`);
  } catch (e) { await shot('ERR-rr'); bad('read-retain flow', e); }

  // ============ COUNTER-PROMPTING ============
  ctxLabel = 'counter-prompting';
  const sBeforeCP = await score();
  try {
    await nav('Counter').click();
    await page.getByRole('button', { name: 'Begin drill' }).waitFor({ timeout: 6000 });
    await shot('08-cp-intro');
    await page.getByRole('button', { name: 'Begin drill' }).click();
    await page.locator('#cp-wrong').waitFor({ timeout: 6000 });
    await shot('09-cp-solving');
    await page.locator('#cp-wrong').fill(
      'Percentage gains and losses are not symmetric: +50% then -50% multiplies by 1.5 x 0.5 = 0.75, a net 25% decline, not zero.'
    );
    await page.getByRole('button', { name: 'Lock in answer' }).click();
    await page.getByText('The flaw', { exact: false }).waitFor({ timeout: 8000 });
    await shot('10-cp-result');
    await page.getByRole('button', { name: 'Save rep' }).click();
    await page.locator('.score-num').first().waitFor({ timeout: 6000 });
    const s3 = await score();
    if (s3 > sBeforeCP) ok('counter-prompting: full flow + score updated', `score ${sBeforeCP}->${s3}`);
    else bad('counter-prompting: score did not increase', `stayed ${s3}`);
  } catch (e) { await shot('ERR-cp'); bad('counter-prompting flow', e); }

  // ============ TODAY after 3 reps + SETTINGS ============
  ctxLabel = 'today-final';
  try {
    await nav('Today').click();
    await page.locator('.ring-center b').first().waitFor({ timeout: 6000 });
    const ring = (await page.locator('.ring-center b').first().textContent())?.trim();
    await shot('11-today-after');
    if (ring === '3/3') ok('today: ring shows 3/3 after all reps', `ring=${ring}`);
    else bad('today: ring not 3/3', `ring=${ring}`);
  } catch (e) { await shot('ERR-today'); bad('today-final', e); }

  ctxLabel = 'settings';
  try {
    await nav('Settings').click();
    await page.waitForTimeout(500);
    await shot('12-settings');
    ok('settings: renders');
  } catch (e) { await shot('ERR-settings'); bad('settings', e); }

} catch (e) {
  bad('fatal', e);
} finally {
  await browser.close();
  const report = {
    steps,
    consoleErrors,
    pageErrors,
    summary: {
      passed: steps.filter((s) => s.status === 'PASS').length,
      failed: steps.filter((s) => s.status === 'FAIL').length,
      consoleErrorCount: consoleErrors.length,
      pageErrorCount: pageErrors.length,
    },
  };
  console.log('E2E_REPORT_JSON ' + JSON.stringify(report, null, 2));
}
