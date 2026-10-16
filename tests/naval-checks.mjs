import assert from 'node:assert/strict';
import { SHIPS } from '../src/data.js';

export async function runNavalChecks(browser, base, errors) {
  // Render a capital ship and exercise both broadsides through the actual fire control.
  const naval = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  naval.on('pageerror', e => errors.push(e.message));
  await naval.addInitScript(ids => {
    localStorage.setItem('iron-tide-profile-v1', JSON.stringify({ credits: 100000, unlocked: ids.filter(id => id !== 'dreadnought'), selected: 'monarch', battles: 0, victories: 0, bestKills: 0 }));
  }, SHIPS.map(s => s.id));
  await naval.goto(base);
  await naval.waitForFunction(() => window.ironTide?.world.renderer.info.render.calls > 0);
  // SwiftShader runs on the test machine CPU; lower pixel fill without changing geometry.
  await naval.evaluate(() => window.ironTide.world.renderer.setPixelRatio(.5));
  await naval.getByRole('button', { name: 'TO BATTLE', exact: true }).click();
  await naval.waitForFunction(() => window.ironTide.battle?.player.type === 'monarch');
  await naval.keyboard.press('Escape');
  await naval.evaluate(() => {
    const b = window.ironTide.battle;
    b.ships.forEach(s => { s.role = 'player'; s.speed = 0; s.throttle = 0; if (s.id !== 0 && s.id !== 2) { s.dead = true; s.hull = 0; s.deadTime = 20; } });
    b.projectiles = [];
    b.player.x = 0; b.player.z = 900; b.player.heading = Math.PI;
    b.ships[2].x = 0; b.ships[2].z = 600; b.ships[2].hull = b.ships[2].stats.hull;
    b.aim = { x: 0, z: 600 }; b.player.aim = { ...b.aim };
  });
  await naval.keyboard.press('Escape');
  await naval.waitForFunction(() => document.querySelector('#battery-guns').textContent.startsWith('6/9'));
  await naval.getByRole('button', { name: 'Fire main battery', exact: true }).click();
  await naval.waitForFunction(() => window.ironTide.battle.damage === window.ironTide.battle.player.stats.shellDamage * 6);
  const bowDamage = await naval.evaluate(() => window.ironTide.battle.damage);
  for (const [heading, label] of [[Math.PI / 2, 'PORT BROADSIDE'], [-Math.PI / 2, 'STARBOARD BROADSIDE']]) {
    await naval.evaluate(heading => {
      const b = window.ironTide.battle; b.player.heading = heading;
      b.player.mounts.forEach(m => m.reload = 0); b.player.reload = 0;
      b.projectiles = []; b.damage = 0; b.ships[2].hull = b.ships[2].stats.hull;
      b.aim = { x: 0, z: 600 }; b.player.aim = { ...b.aim };
    }, heading);
    await naval.waitForFunction(text => document.querySelector('#battery-bearing').textContent === text, label);
    assert.match(await naval.locator('#battery-guns').innerText(), /9\/9/);
    await naval.getByRole('button', { name: 'Fire main battery', exact: true }).click();
    await naval.waitForFunction(() => window.ironTide.battle.damage === window.ironTide.battle.player.stats.damage);
    assert.ok(await naval.evaluate(() => window.ironTide.battle.damage) > bowDamage);
  }
  await naval.screenshot({ animations: 'disabled', path: 'artifacts/starboard-broadside.png' });
  await naval.keyboard.press('Escape');
  await naval.getByRole('button', { name: 'ABANDON SORTIE' }).click();
  await naval.getByRole('button', { name: 'RETURN TO HARBOR' }).click();
  await naval.getByRole('button', { name: 'RESEARCH', exact: true }).click();
  assert.equal(await naval.locator('.research-lane').count(), 3);
  assert.equal(await naval.locator('.research-ship').count(), 12);
  const unlock = naval.locator('[data-action="unlock"][data-id="dreadnought"]');
  await unlock.scrollIntoViewIfNeeded();
  const closeBounds = await naval.getByRole('button', { name: 'Close dialog' }).boundingBox();
  assert.ok(closeBounds.y >= 25 && closeBounds.y <= 100, 'close remains visible at the bottom of the tech tree');
  const scrollTop = await naval.locator('.modal').evaluate(node => node.scrollTop);
  assert.ok(scrollTop > 0);
  await unlock.click();
  assert.ok(await naval.locator('.modal').evaluate(node => node.scrollTop) >= scrollTop - 5, 'research preserves the tree scroll position');
  await naval.locator('[data-action="equip"][data-id="dreadnought"]').click();
  await naval.waitForFunction(() => window.ironTide.world.showroomShip.userData.stats.id === 'dreadnought');
  assert.ok(await naval.locator('.stat-track').evaluateAll(tracks => tracks.every(track => track.querySelector('i').getBoundingClientRect().width <= track.getBoundingClientRect().width + 1)), 'advanced-ship stats stay inside their tracks');
  await naval.screenshot({ animations: 'disabled', path: 'artifacts/dreadnought-harbor.png' });
  assert.deepEqual(errors, [], 'No capital-ship browser errors');
  console.log('PASS: capital-ship bow fire, port and starboard full broadsides, increased actual damage, three research branches and Dreadnought rendering.');
}
