import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OBB } from 'three/addons/math/OBB.js';
import { SHIPS, TECH_BRANCHES, freshProfile, unlockShip, readProfile } from '../src/data.js';
import { Battle } from '../src/simulation.js';
import { batterySolution, muzzlePosition, damageForCaliber } from '../src/weapons.js';

function shipFor(stats) {
  return { stats, x: 0, z: 0, heading: 0, mounts: stats.mounts.map(() => ({ reload: 0 })) };
}
function bodyOBB(mount) {
  return new OBB(new THREE.Vector3(mount.position.x, mount.deckY + 2.9, mount.position.z), new THREE.Vector3((mount.width + .6) / 2, 2.9, mount.depth / 2 + .1), new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationY(mount.yaw)));
}
function segmentHitsBody(a, b, body, radius) {
  const rotation = body.rotation.clone().transpose();
  const start = new THREE.Vector3(a.x, a.y, a.z).sub(body.center).applyMatrix3(rotation);
  const end = new THREE.Vector3(b.x, b.y, b.z).sub(body.center).applyMatrix3(rotation);
  const half = body.halfSize.clone().addScalar(radius);
  const box = new THREE.Box3(half.clone().negate(), half);
  if (box.containsPoint(start)) return true;
  const direction = end.clone().sub(start), length = direction.length();
  const hit = new THREE.Ray(start, direction.normalize()).intersectBox(box, new THREE.Vector3());
  return !!hit && start.distanceTo(hit) < length;
}

test('all 12 ships unmask every gun on either flank, with fewer guns bow-on or stern-on', () => {
  for (const stats of SHIPS) {
    const ship = shipFor(stats);
    for (const x of [-1200, 1200]) {
      const solution = batterySolution(ship, { x, z: 0 });
      assert.equal(solution.guns, stats.guns, stats.name);
      assert.equal(solution.damage, stats.damage);
      assert.equal(solution.broadside, true);
      assert.equal(solution.side, x < 0 ? 'STARBOARD' : 'PORT');
    }
    assert.equal(batterySolution(ship, { x: 0, z: 1200 }).guns, stats.foreTurrets * stats.barrels);
    assert.equal(batterySolution(ship, { x: 0, z: -1200 }).guns, stats.aftTurrets * stats.barrels);
  }
});

test('turret housings, gun barrels and superstructures stay clear through complete aiming sweeps', () => {
  for (const stats of SHIPS) {
    const ship = shipFor(stats), b = stats.beam * 1.6, l = stats.length;
    const structures = [
      new OBB(new THREE.Vector3(0, 7.5, -l * .01), new THREE.Vector3(b * .32, 1.5, l * .16)),
      new OBB(new THREE.Vector3(0, 11, l * .1), new THREE.Vector3(b * .285, 2.8, l * .06)),
      new OBB(new THREE.Vector3(0, 15, l * .105), new THREE.Vector3(b * .34, 1.35, l * .0525)),
    ];
    for (let degrees = 0; degrees < 360; degrees += 10) {
      const angle = degrees * Math.PI / 180;
      const solution = batterySolution(ship, { x: Math.sin(angle) * 1200, z: Math.cos(angle) * 1200 });
      const bodies = solution.mounts.map(bodyOBB);
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) assert.equal(bodies[i].intersectsOBB(bodies[j]), false, `${stats.name}: housings ${i}/${j} at ${degrees}°`);
        for (const structure of structures) assert.equal(bodies[i].intersectsOBB(structure), false, `${stats.name}: housing intersects bridge at ${degrees}°`);
        const mount = solution.mounts[i], yaw = mount.yaw;
        for (let barrel = 0; barrel < mount.count; barrel++) {
          const offset = (barrel - (mount.count - 1) / 2) * mount.spacing;
          const start = { x: mount.position.x + Math.cos(yaw) * offset + Math.sin(yaw) * mount.depth * .3, y: mount.deckY + mount.bore, z: mount.position.z - Math.sin(yaw) * offset + Math.cos(yaw) * mount.depth * .3 };
          const end = muzzlePosition(ship, mount, barrel);
          for (let j = 0; j < bodies.length; j++) if (j !== i) assert.equal(segmentHitsBody(start, end, bodies[j], mount.barrelRadius * 1.65), false, `${stats.name}: gun ${i} clips turret ${j} at ${degrees}°`);
          for (const structure of structures) assert.equal(segmentHitsBody(start, end, structure, mount.barrelRadius * 1.65), false, `${stats.name}: gun ${i} clips bridge at ${degrees}°`);
        }
      }
    }
  }
});

test('per-shell damage increases strictly with caliber and every gun contributes to the broadside', () => {
  const calibers = [...new Set(SHIPS.map(s => s.caliberMm))].sort((a, b) => a - b);
  for (let i = 1; i < calibers.length; i++) assert.ok(damageForCaliber(calibers[i]) > damageForCaliber(calibers[i - 1]));
  for (const stats of SHIPS) assert.equal(stats.damage, stats.guns * stats.shellDamage);
});

function firingDuel(id, heading) {
  const b = new Battle(id);
  b.ships.forEach(s => { s.dead = s.role === 'ally' || s.id > 2; s.role = 'player'; s.throttle = 0; });
  b.player.x = 0; b.player.z = 900; b.player.heading = heading;
  const target = b.ships[2]; target.x = 0; target.z = 600; target.hull = 50000;
  b.aim = target;
  return [b, target];
}
function settle(b) { for (let i = 0; i < 25; i++) b.step(.05); }

test('both actual broadsides spawn every shell and deal more damage than a bow salvo', () => {
  for (const id of ['kestrel', 'monarch', 'dreadnought']) {
    const [bow, bowTarget] = firingDuel(id, Math.PI);
    bow.fire(bow.player, bowTarget); const bowShells = bow.projectiles.length; settle(bow);
    for (const heading of [Math.PI / 2, -Math.PI / 2]) {
      const [b, target] = firingDuel(id, heading); b.fire(b.player, target);
      assert.equal(b.projectiles.length, b.player.stats.guns);
      assert.ok(b.projectiles.length > bowShells);
      assert.equal(new Set(b.projectiles.map(p => p.mount)).size, b.player.stats.mounts.length);
      assert.ok(b.projectiles.every(p => p.sy > 9 && p.damage === b.player.stats.shellDamage));
      settle(b);
      assert.equal(b.damage, b.player.stats.damage);
      assert.ok(b.damage > bow.damage);
    }
  }
});

test('a loaded stern turret can join the broadside while the forward turret reloads', () => {
  const [b, target] = firingDuel('kestrel', Math.PI);
  b.fire(b.player, target); assert.equal(b.projectiles.length, 2);
  b.player.heading = Math.PI / 2;
  assert.equal(b.fire(b.player, target), true);
  assert.equal(b.projectiles.length, 4);
  assert.equal(b.fire(b.player, target), false);
  assert.ok(b.player.mounts.every(m => m.reload > 0));
});

test('the three research branches are reachable, require named predecessors and preserve saved fleets', () => {
  assert.equal(SHIPS.length, 12); assert.equal(TECH_BRANCHES.length, 3);
  assert.equal(new Set(TECH_BRANCHES.flatMap(b => b.ships)).size, 12);
  const p = freshProfile(); p.credits = 100000;
  assert.equal(unlockShip(p, 'dreadnought'), false);
  for (const id of ['resolute', 'monarch', 'sovereign', 'leviathan', 'dreadnought']) assert.equal(unlockShip(p, id), true, id);
  assert.equal(p.unlocked.includes('vanguard'), false, 'capital branch does not require the destroyer branch');
  assert.equal(unlockShip(p, 'phantom'), false);
  for (const id of ['vanguard', 'tempest', 'phantom', 'bastion', 'sentinel', 'valiant']) assert.equal(unlockShip(p, id), true, id);
  assert.equal(p.unlocked.length, 12);
  const old = { ...freshProfile(), credits: 1777, selected: 'monarch', unlocked: ['kestrel', 'vanguard', 'resolute', 'monarch'] };
  assert.deepEqual(readProfile({ getItem: () => JSON.stringify(old) }), old);
});
