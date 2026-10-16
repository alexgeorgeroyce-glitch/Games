import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
const server = process.env.TEST_BASE_URL ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { stdio: 'pipe' });
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base)).ok) break; } catch {}
    if (i === 99) throw Error('Dev server did not start');
    await new Promise(r => setTimeout(r, 150));
  }
  await mkdir('artifacts', { recursive: true });
  const launch = { headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
  if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
  else {
    const { existsSync } = await import('node:fs');
    if (existsSync('/usr/bin/chromium')) launch.executablePath = '/usr/bin/chromium';
  }
  browser = await chromium.launch(launch);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base);
  await page.waitForFunction(() => window.ironTide?.world.renderer.info.render.calls > 0);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
  assert.equal(await page.getByRole('heading', { name: 'Kestrel.' }).count(), 1);
  await page.screenshot({ path: 'artifacts/harbor.png' });
  await page.getByRole('button', { name: 'HOW TO PLAY' }).click();
  await page.waitForSelector('[role="dialog"]');
  assert.match(await page.locator('.modal').innerText(), /Lead your target/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'RESEARCH', exact: true }).click();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.research-ship').count(), 4);
  assert.equal(await page.locator('.research-ship button:disabled').count(), 3);
  await page.screenshot({ path: 'artifacts/research.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'TO BATTLE', exact: true }).click();
  await page.waitForFunction(() => window.ironTide?.battle?.time > .3);
  assert.equal(await page.evaluate(() => window.ironTide.battle.ships.length), 5);
  await page.keyboard.down('w');
  await page.waitForFunction(() => window.ironTide.battle.player.throttle > .2);
  await page.keyboard.up('w');
  assert.ok(await page.evaluate(() => window.ironTide.battle.player.speed > 0));
  const oldHeading = await page.evaluate(() => window.ironTide.battle.player.heading);
  await page.keyboard.down('a');
  await page.waitForFunction(h => window.ironTide.battle.player.heading > h + .05, oldHeading);
  await page.keyboard.up('a');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.modal');
  const frozenTime = await page.evaluate(() => window.ironTide.battle.time);
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.ironTide.battle.time), frozenTime);
  await page.getByRole('button', { name: 'RESUME BATTLE' }).click();
  await page.waitForFunction(t => window.ironTide.battle.time > t, frozenTime);
  await page.mouse.move(730, 300);
  await page.mouse.down();
  await page.waitForFunction(() => window.ironTide.battle.player.reload > 0);
  await page.mouse.up();
  await page.keyboard.press('q');
  await page.waitForFunction(() => window.ironTide.battle.player.torpedoes === 5);
  await page.evaluate(() => window.ironTide.battle.hit(window.ironTide.battle.player, 300, 2));
  await page.keyboard.press('r');
  await page.waitForFunction(() => window.ironTide.battle.player.repairTime > 0);
  assert.equal(await page.evaluate(() => window.ironTide.battle.player.repairs), 1);
  await page.screenshot({ path: 'artifacts/battle.png' });
  // Arrange a near-complete engagement; let the regular frame loop deliver its outcome.
  await page.evaluate(() => {
    const b = window.ironTide.battle;
    for (const s of b.ships.filter(s => s.team === 1)) b.hit(s, s.hull, b.player.id);
  });
  await page.waitForSelector('.result-modal');
  assert.match(await page.locator('.result-modal').innerText(), /The sea is yours/);
  const credits = await page.evaluate(() => window.ironTide.profile.credits);
  assert.ok(credits >= 600);
  assert.equal(await page.evaluate(() => window.ironTide.profile.battles), 1);
  await page.screenshot({ path: 'artifacts/victory.png' });
  await page.getByRole('button', { name: 'RETURN TO HARBOR' }).click();
  await page.getByRole('button', { name: 'RESEARCH', exact: true }).click();
  await page.locator('[data-action="unlock"][data-id="vanguard"]').click();
  assert.equal(await page.evaluate(() => window.ironTide.profile.credits), credits - 600);
  await page.locator('[data-action="equip"][data-id="vanguard"]').click();
  await page.waitForSelector('h1');
  assert.match(await page.locator('h1').innerText(), /Vanguard/);
  await page.reload();
  await page.waitForFunction(() => window.ironTide?.profile.selected === 'vanguard');
  assert.match(await page.locator('h1').innerText(), /Vanguard/);
  assert.equal(await page.evaluate(() => window.ironTide.profile.victories), 1);
  // A second sortie checks that harbor cleanup and a new render scene work.
  await page.getByRole('button', { name: 'TO BATTLE', exact: true }).click();
  await page.waitForFunction(() => window.ironTide.battle?.player.type === 'vanguard');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'ABANDON SORTIE' }).click();
  await page.waitForSelector('.result-modal');
  assert.match(await page.locator('.result-modal').innerText(), /A hard-fought battle/);
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  mobile.on('pageerror', e => errors.push(e.message));
  await mobile.goto(base);
  await mobile.waitForFunction(() => window.ironTide?.world.renderer.info.render.calls > 0);
  await mobile.waitForTimeout(450);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await mobile.screenshot({ path: 'artifacts/mobile-harbor.png', fullPage: true });
  await mobile.getByRole('button', { name: 'RESEARCH', exact: true }).tap();
  await mobile.waitForSelector('.research-tree'); await mobile.waitForTimeout(350);
  await mobile.screenshot({ path: 'artifacts/mobile-research.png' });
  await mobile.getByRole('button', { name: 'Close dialog' }).tap();
  await mobile.getByRole('button', { name: 'TO BATTLE', exact: true }).tap();
  await mobile.waitForSelector('.touch-helm');
  const touchButton = await mobile.getByRole('button', { name: 'Increase throttle' }).boundingBox();
  const cdp = await mobile.context().newCDPSession(mobile);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchButton.x + 20, y: touchButton.y + 20 }] });
  await mobile.waitForFunction(() => window.ironTide.battle.player.throttle > .1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mobile.screenshot({ path: 'artifacts/mobile-battle.png' });
  assert.deepEqual(errors, [], 'No browser runtime or rendering errors');
  console.log('PASS: WebGL harbor, controls, research gates, deployment, throttle/rudder, pause/resume, shell fire, torpedoes, repairs, victory/rewards, research/equip, persisted fleet, second sortie, defeat, mobile layout and touch helm.');
} finally {
  await browser?.close();
  server?.kill('SIGTERM');
}
