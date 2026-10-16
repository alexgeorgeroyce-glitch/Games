import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/simulation.js';
import { SHIPS, freshProfile, readProfile, unlockShip, rewardFor } from '../src/data.js';

const advance = (b, seconds) => { for (let n = 0; n < seconds * 20; n++) b.step(.05); };
function duel() {
  const b = new Battle();
  b.ships.forEach(s => { s.dead = s.team === 0 && s !== b.player || s.id > 2; s.role = 'player'; s.throttle = 0; });
  const target = b.ships[2]; target.x = 0; target.z = 600;
  b.player.x = 0; b.player.z = 900;
  return [b, target];
}

test('ship classes and difficulty create the intended fleets', () => {
  for (const s of SHIPS) {
    const b = new Battle(s.id);
    assert.equal(b.player.hull, s.hull);
    assert.equal(b.player.torpedoes, s.torpedoes);
    assert.equal(b.ships.filter(s => s.team === 1).length, 3);
  }
  assert.equal(new Battle('kestrel', 'veteran').ships.length, 6);
});

test('engine throttle persists, rudder turns, and reverse is bounded', () => {
  const b = new Battle(); b.input.throttle = 1; advance(b, 4);
  assert.equal(b.player.throttle, 1);
  const start = b.player.z; b.input.throttle = 0; b.input.steer = 1; advance(b, 2);
  assert.ok(b.player.z < start); assert.ok(b.player.heading > Math.PI);
  b.input.throttle = -1; advance(b, 8);
  assert.equal(b.player.throttle, -.35);
});

test('bow fire uses only its forward guns and observes their reload', () => {
  const [b, target] = duel(); const hull = target.hull;
  assert.equal(b.fire(b.player, target), true);
  assert.equal(b.fire(b.player, target), false);
  assert.equal(target.hull, hull, 'shells must travel before damaging the target');
  advance(b, 1);
  assert.equal(Math.round(hull - target.hull), b.player.stats.foreTurrets * b.player.stats.barrels * b.player.stats.shellDamage);
  assert.equal(Math.round(b.damage), b.player.stats.foreTurrets * b.player.stats.barrels * b.player.stats.shellDamage);
  advance(b, 3); assert.equal(b.player.reload, 0);
  assert.equal(b.fire(b.player, target), true);
});

test('aiming beyond range and malformed targets does not spend a reload', () => {
  const b = new Battle();
  assert.equal(b.fire(b.player, { x: NaN, z: 10 }), false);
  assert.equal(b.fire(b.player, { x: 9000, z: 9000 }), false);
  assert.equal(b.player.reload, 0);
});

test('a missed salvo splashes without dealing damage', () => {
  const [b, target] = duel();
  b.fire(b.player, { x: 150, z: 600 }); advance(b, 2);
  assert.equal(target.hull, target.stats.hull);
  assert.equal(b.damage, 0);
  assert.ok(b.events.some(e => e.type === 'splash'));
});

test('torpedoes travel, damage enemy ships and consume limited ammunition', () => {
  const [b, target] = duel();
  const ammo = b.player.torpedoes;
  assert.equal(b.fire(b.player, target, true), true);
  assert.equal(b.player.torpedoes, ammo - 1);
  assert.equal(b.fire(b.player, target, true), false);
  advance(b, 3);
  assert.equal(target.hull, target.stats.hull - 950);
  assert.equal(b.damage, 950);
});

test('battleships have no torpedoes', () => {
  const b = new Battle('monarch');
  assert.equal(b.fire(b.player, { x: 0, z: 0 }, true), false);
});

test('repair restores 36% over eight seconds and consumes one charge', () => {
  const [b] = duel(); b.player.hull = 500;
  assert.equal(b.repair(), true); assert.equal(b.player.repairs, 1);
  assert.equal(b.repair(), false);
  advance(b, 8.1);
  assert.ok(Math.abs(b.player.hull - 932) < .01);
  assert.equal(b.player.repairTime, 0);
  b.player.hull = b.player.stats.hull;
  assert.equal(b.repair(), false);
  assert.equal(b.player.repairs, 1);
});

test('friendly projectiles do not damage allied vessels', () => {
  const [b, target] = duel(); target.team = 0;
  b.fire(b.player, target); advance(b, 1);
  assert.equal(target.hull, target.stats.hull);
});

test('holding objective A completes the mission', () => {
  const [b, target] = duel();
  b.player.x = 0; b.player.z = 0; target.x = 1400; target.z = -700;
  advance(b, 54);
  assert.equal(b.result, 'victory'); assert.equal(b.capture, 100);
  assert.ok(b.capSeconds > 52);
  assert.equal(b.events.filter(e => e.type === 'end').length, 1);
});

test('a contested objective gives neither team capture progress', () => {
  const [b, target] = duel(); b.player.x = target.x = 0; b.player.z = 0; target.z = 140;
  advance(b, 5); assert.equal(b.capture, 0); assert.equal(b.enemyCapture, 0);
  assert.equal(b.contested, true);
});

test('eliminating hostiles wins once and destroyed players lose', () => {
  const [b, target] = duel(); b.hit(target, 9999, b.player.id); b.step(.05);
  assert.equal(b.kills, 1); assert.equal(b.result, 'victory');
  b.finish('defeat'); assert.equal(b.events.filter(e => e.type === 'end').length, 1);
  const loss = new Battle(); loss.hit(loss.player, 9999, 2); loss.step(.05);
  assert.equal(loss.result, 'defeat');
});

test('AI navigates, fires, and resolves a full unattended operation without invalid state', () => {
  for (const difficulty of ['cadet', 'standard', 'veteran']) {
    const b = new Battle('kestrel', difficulty); advance(b, 305);
    assert.ok(b.events.some(e => e.type === 'fire'));
    assert.ok(b.ships.some(s => s.team === 1 && s.z > -600));
    assert.ok(['victory', 'defeat'].includes(b.result));
    for (const s of b.ships) for (const key of ['x', 'z', 'heading', 'hull', 'speed']) assert.ok(Number.isFinite(s[key]), `${difficulty} ${s.name} ${key}`);
  }
});

test('research requires the previous ship, spends credits once, and equips owned ships', () => {
  const p = freshProfile(); p.credits = 5000;
  assert.equal(unlockShip(p, 'monarch'), false);
  assert.equal(unlockShip(p, 'vanguard'), true); assert.equal(p.credits, 4400);
  assert.equal(unlockShip(p, 'vanguard'), false); assert.equal(p.credits, 4400);
  assert.equal(unlockShip(p, 'resolute'), true); assert.equal(p.credits, 2900);
  assert.equal(unlockShip(p, 'monarch'), false);
  p.credits += 100; assert.equal(unlockShip(p, 'monarch'), true); assert.equal(p.credits, 0);
});

test('progress reloads safely and corrupted storage falls back to a fresh fleet', () => {
  for (const value of ['invalid json', '{}', '{"credits":-1,"unlocked":[]}']) assert.deepEqual(readProfile({ getItem: () => value }), freshProfile());
  assert.deepEqual(readProfile({ getItem: () => { throw Error('storage denied'); } }), freshProfile());
  const p = freshProfile(); p.credits = 800; p.unlocked.push('vanguard'); p.selected = 'vanguard';
  assert.deepEqual(readProfile({ getItem: () => JSON.stringify(p) }), p);
});

test('victories and combat contributions earn usable progression rewards', () => {
  assert.equal(rewardFor('defeat', 0, 0, 0), 120);
  assert.equal(rewardFor('victory', 2, 2100, 30), 868);
  assert.ok(rewardFor('victory', 2, 2100, 30) >= SHIPS[1].cost);
});
