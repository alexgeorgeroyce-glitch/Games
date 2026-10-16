import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SHIPS } from '../src/data.js';
import { makeShip, animateShip, createHullGeometry, sharedShipMaterials } from '../src/ships.js';
import { NavalAudio, readAudioSettings } from '../src/audio.js';

function dispose(ship) {
  ship.traverse(object => {
    object.geometry?.dispose();
    if (object.material && !sharedShipMaterials.has(object.material)) object.material.dispose();
  });
}

test('each detailed ship has a curved, finite mesh and a bounded rendering cost', () => {
  for (const stats of SHIPS) {
    const ship = makeShip(stats.id);
    assert.ok(ship.userData.triangles > 50000, `${stats.name} has detailed geometry`);
    assert.ok(ship.userData.triangles < 120000, 'geometry stays within the fleet budget');
    assert.ok(ship.userData.drawCalls <= 32, 'deck fittings are batched');
    const bounds = new THREE.Box3().setFromObject(ship), size = bounds.getSize(new THREE.Vector3());
    assert.ok(size.z >= stats.length * .98 && size.z < stats.length * 1.2, 'ship length is preserved');
    assert.ok(size.y >= 35 && size.y < 40, 'mast and underwater hull are present');
    ship.traverse(object => {
      if (!object.geometry) return;
      for (const attribute of ['position', 'normal']) {
        assert.ok(object.geometry.attributes[attribute]);
        assert.ok(object.geometry.attributes[attribute].array.every(Number.isFinite), `${stats.name}: finite ${attribute}`);
      }
    });
    const expectedTurrets = stats.id === 'resolute' ? 4 : ['monarch', 'vanguard'].includes(stats.id) ? 3 : 2;
    assert.equal(ship.userData.turrets.length, expectedTurrets);
    assert.equal(ship.userData.turrets.length * (stats.id === 'monarch' ? 3 : 2), stats.guns);
    dispose(ship);
  }
});

test('hull normals point outward and deck edges retain the specified width', () => {
  const geometry = createHullGeometry(80, 16, 6, 8.5);
  const p = geometry.attributes.position, n = geometry.attributes.normal;
  const middlePort = 40 * 21;
  assert.ok(p.getX(middlePort) < -7.9);
  assert.ok(n.getX(middlePort) < -.4, 'port-side normals point outside the hull');
  assert.ok(n.getY(middlePort + 10) < -.8, 'keel normals face the water below');
  geometry.dispose();
});

test('flag animation deforms cloth without moving its attachment edge or changing its bounds', () => {
  const ship = makeShip('kestrel'), positions = ship.userData.flag.geometry.attributes.position;
  animateShip(ship, .37);
  let moving = false;
  for (let i = 0; i < positions.count; i++) {
    assert.ok(Math.abs(positions.getZ(i)) <= .201);
    if (positions.getX(i) === -2) assert.equal(Math.abs(positions.getZ(i)), 0);
    else if (Math.abs(positions.getZ(i)) > .01) moving = true;
  }
  assert.ok(moving); dispose(ship);
});

test('audio preferences use safe defaults, validate values and remember mute and volume', async () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.deepEqual(readAudioSettings(storage), { enabled: true, volume: .65 });
  const audio = new NavalAudio({ storage, contextFactory: () => null });
  audio.setVolume(.37); audio.setEnabled(false);
  assert.deepEqual(readAudioSettings(storage), { enabled: false, volume: .37 });
  audio.setVolume(20); assert.equal(audio.volume, 1);
  audio.setVolume(-2); assert.equal(audio.volume, 0);
  audio.setVolume(NaN); assert.equal(audio.volume, .65);
  assert.equal(await audio.unlock(), false);
  assert.equal(audio.measureLevel(), 0);
  assert.equal(audio.play('fire'), false);
  assert.deepEqual(readAudioSettings({ getItem: () => 'malformed' }), { enabled: true, volume: .65 });
});

test('audio is optional when browser storage or Web Audio is unavailable', async () => {
  const audio = new NavalAudio({ storage: { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } }, contextFactory: () => null });
  assert.equal(await audio.unlock(), false);
  audio.setVolume(.2); audio.setEnabled(false); audio.setEnabled(true);
  audio.update(null); await audio.setHidden(true); await audio.setHidden(false);
  assert.equal(audio.status.state, 'locked');
});
