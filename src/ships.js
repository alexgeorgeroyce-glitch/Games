import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SHIPS } from './data.js';

const surface = (color, roughness = .65, metalness = .3) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const steel = surface(0x9caaa9), charcoal = surface(0x25353c, .5, .5);
const teak = surface(0x857e65, .95, .02), seams = surface(0x53584d, .95, .02);
const pale = surface(0xc5cbc2), boot = surface(0x343e40), antifouling = surface(0x733d36, .85, .1);
const brass = surface(0xa29671, .42, .65), glass = surface(0x1d4759, .18, .6);
const safety = surface(0xbd7950, .8, .05);
export const sharedShipMaterials = new Set([steel, charcoal, teak, seams, pale, boot, antifouling, brass, glass, safety]);

function mesh(group, geometry, material, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material); object.position.set(x, y, z); group.add(object); return object;
}
function box(group, w, h, d, x, y, z, material = steel, radius = 0) {
  return mesh(group, radius ? new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d), material, x, y, z);
}
function cylinder(group, r1, r2, h, x, y, z, material = steel, segments = 32) {
  return mesh(group, new THREE.CylinderGeometry(r1, r2, h, segments), material, x, y, z);
}
function pipe(group, points, radius = .08, material = steel, segments = 32, sides = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return mesh(group, new THREE.TubeGeometry(curve, segments, radius, sides, false), material);
}
export function hullWidth(t, beam) {
  const stern = Math.sin(Math.min(1, (t + .027) / .15) * Math.PI / 2);
  const bow = Math.pow(Math.sin(Math.min(1, (1 - t) / .34) * Math.PI / 2), .88);
  return Math.max(.025, stern * bow) * beam / 2;
}

// Longitudinal stations and rounded cross-sections retain a crisp deck edge.
export function createHullGeometry(length, beam, top, depth, stations = 80, slices = 20, arc = [0, Math.PI]) {
  const positions = [], indices = [];
  for (let i = 0; i <= stations; i++) {
    const t = i / stations, width = hullWidth(t, beam);
    for (let j = 0; j <= slices; j++) {
      const a = arc[0] + j / slices * (arc[1] - arc[0]);
      positions.push(-Math.cos(a) * width, top - Math.pow(Math.sin(a), .72) * depth, (t - .5) * length);
    }
  }
  for (let i = 0; i < stations; i++) for (let j = 0; j < slices; j++) {
    const a = i * (slices + 1) + j, b = a + slices + 1;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  // End caps close the transom and bow without softening their edges.
  for (const i of [0, stations]) for (let j = 1; j < slices; j++) {
    const a = i * (slices + 1);
    if (i === 0) indices.push(a, a + j, a + j + 1);
    else indices.push(a, a + j + 1, a + j);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}
function deckGeometry(length, beam, y, stations = 80) {
  const positions = [], indices = [];
  for (let i = 0; i <= stations; i++) {
    const width = hullWidth(i / stations, beam), z = (i / stations - .5) * length;
    positions.push(-width, y, z, width, y, z);
  }
  for (let i = 0; i < stations; i++) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

// Bake static fittings into one mesh per material. More geometry without hundreds of draw calls.
export function batchFittings(group) {
  group.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(group.matrixWorld).invert(), batches = new Map();
  group.traverse(object => {
    if (!object.isMesh) return;
    let geometry = object.geometry.clone();
    if (geometry.index) { const indexed = geometry; geometry = indexed.toNonIndexed(); indexed.dispose(); }
    for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal'].includes(name)) geometry.deleteAttribute(name);
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    if (!batches.has(object.material)) batches.set(object.material, []);
    batches.get(object.material).push(geometry);
    object.geometry.dispose();
  });
  group.clear();
  for (const [material, geometries] of batches) {
    const geometry = mergeGeometries(geometries); geometries.forEach(g => g.dispose());
    if (!geometry) throw Error('Unable to combine ship fittings');
    mesh(group, geometry, material);
  }
  return group;
}

function makeTurret(beam, length, barrels, paint) {
  const group = new THREE.Group();
  cylinder(group, beam * .225, beam * .25, 1.7, 0, .8, 0, charcoal, 48);
  cylinder(group, beam * .235, beam * .235, .25, 0, 1.8, 0, steel, 48);
  box(group, beam * .53, 3.3, beam * .55, 0, 3.4, 0, paint, .65);
  box(group, beam * .32, .2, beam * .36, 0, 5.1, 0, pale, .08);
  for (let j = 0; j < barrels; j++) {
    const x = (j - (barrels - 1) / 2) * (beam > 20 ? 1.85 : 1.25);
    const barrel = cylinder(group, .24, .43, length * .16, x, 3.3, length * .105, charcoal);
    barrel.rotation.x = Math.PI / 2;
    const sleeve = cylinder(group, .49, .56, length * .045, x, 3.3, length * .045, paint);
    sleeve.rotation.x = Math.PI / 2;
    const muzzle = mesh(group, new THREE.TorusGeometry(.27, .08, 8, 24), steel, x, 3.3, length * .185);
    muzzle.rotation.x = 0;
    mesh(group, new THREE.CircleGeometry(.23, 24), charcoal, x, 3.3, length * .185 + .01);
  }
  for (const side of [-1, 1]) {
    box(group, .45, .8, beam * .2, side * beam * .28, 3.3, -.3, charcoal, .15);
    for (let i = 0; i < 3; i++) box(group, .05, .13, beam * .12, side * beam * .285, 3 + i * .3, -.3, steel);
  }
  return batchFittings(group);
}

function makeLifeboat(group, x, y, z, side) {
  const boat = new THREE.Group(); boat.position.set(x, y, z);
  mesh(boat, createHullGeometry(7, 2.2, 0, 1.1, 28, 12), pale);
  mesh(boat, deckGeometry(6.6, 1.9, -.25, 28), teak);
  for (let i = 0; i < 3; i++) box(boat, 1.55, .13, .45, 0, .05, -1.6 + i * 1.6, pale, .04);
  for (const end of [-1, 1]) pipe(boat, [[-side * 1.8, -1.4, end * 2.5], [-side * 1.8, 2.8, end * 2.5], [0, 3.2, end * 2.5], [0, .3, end * 2.5]], .1, steel, 14);
  group.add(boat);
}

function makeAA(group, x, y, z, side) {
  const gun = new THREE.Group(); gun.position.set(x, y, z); gun.rotation.y = side * Math.PI / 2;
  cylinder(gun, .7, 1, 1, 0, .5, 0, charcoal, 24);
  box(gun, 1.3, 1, 1.5, 0, 1.4, 0, steel, .2);
  for (const s of [-1, 1]) {
    const barrel = cylinder(gun, .085, .14, 3, s * .28, 1.9, 1.5, charcoal, 16); barrel.rotation.x = Math.PI / 2 - .2;
    box(gun, .15, 1.6, 1.5, s * .9, 1.3, -.1, steel, .05);
  }
  group.add(gun);
}

export function makeShip(type) {
  const stats = SHIPS.find(ship => ship.id === type) || SHIPS[0];
  const ship = new THREE.Group(), fittings = new THREE.Group(); ship.add(fittings);
  const l = stats.length, b = stats.beam * 1.6, paint = surface(stats.color, .57, .4);
  const paintAngle = Math.asin(Math.pow((6 - 1.25) / 8.5, 1 / .72));
  const waterlineAngle = Math.asin(Math.pow((6 - .5) / 8.5, 1 / .72));
  for (const arc of [[0, paintAngle], [Math.PI - paintAngle, Math.PI]]) mesh(fittings, createHullGeometry(l, b, 6, 8.5, 80, 16, arc), paint);
  for (const arc of [[paintAngle, waterlineAngle], [Math.PI - waterlineAngle, Math.PI - paintAngle]]) mesh(fittings, createHullGeometry(l, b, 6, 8.5, 80, 6, arc), boot);
  mesh(fittings, createHullGeometry(l, b, 6, 8.5, 80, 24, [waterlineAngle, Math.PI - waterlineAngle]), antifouling);
  mesh(fittings, deckGeometry(l * .985, b * .95, 6.06), teak);
  for (let i = 1; i < 90; i++) {
    const t = i / 90, width = hullWidth(t, b * .94);
    box(fittings, width * 2, .018, .026, 0, 6.08, (t - .5) * l, seams);
  }
  box(fittings, b * .64, 3, l * .45, 0, 7.5, -l * .05, paint, .45);
  box(fittings, b * .57, 5.6, l * .12, 0, 11, l * .1, paint, .6);
  box(fittings, b * .68, 2.7, l * .105, 0, 15, l * .105, pale, .4);
  box(fittings, b * .71, .35, l * .115, 0, 16.55, l * .105, paint, .12);
  // Glazed wheelhouse, individual portholes, bridge wings and navigation lamps.
  for (let i = -2; i <= 2; i++) box(fittings, b * .105, 1, .16, i * b * .12, 15, l * .158, glass, .06);
  for (const side of [-1, 1]) {
    box(fittings, .16, 1, l * .07, side * b * .342, 15, l * .1, glass, .06);
    box(fittings, b * .18, .4, l * .1, side * b * .4, 13.6, l * .1, paint, .15);
    cylinder(fittings, .22, .28, .35, side * b * .47, 14.2, l * .135, side < 0 ? safety : brass, 20);
    for (let i = 0; i < 19; i++) {
      const t = .16 + i / 19 * .65, z = (t - .5) * l, x = (hullWidth(t, b) * Math.sqrt(1 - Math.pow((6 - 4.65) / 8.5, 2 / .72)) + .035) * side;
      const rim = mesh(fittings, new THREE.TorusGeometry(.27, .055, 8, 20), brass, x, 4.65, z); rim.rotation.y = Math.PI / 2;
      const window = cylinder(fittings, .23, .23, .06, x, 4.65, z, glass, 20); window.rotation.z = Math.PI / 2;
    }
    makeLifeboat(fittings, side * b * .48, 9.5, -l * .1, side);
    for (const z of [-.23, .17]) makeAA(fittings, side * b * .34, 8.9, l * z, side);
  }
  for (let i = 0; i < 2; i++) {
    const z = -l * (.045 + i * .13), r = b * .16;
    cylinder(fittings, r, r * 1.12, 7, 0, 12, z, paint, 48);
    cylinder(fittings, r * 1.04, r * 1.04, .55, 0, 15.7, z, charcoal, 48);
    const rim = mesh(fittings, new THREE.TorusGeometry(r, .14, 8, 48), steel, 0, 16.02, z); rim.rotation.x = Math.PI / 2;
    cylinder(fittings, r * .78, r * .78, .05, 0, 16.03, z, charcoal, 40);
    for (let j = 0; j < 5; j++) box(fittings, r * 1.4, .11, .12, 0, 16.09, z + (j - 2) * r * .24, steel);
    for (let j = 0; j < 7; j++) box(fittings, .8, .075, .08, r * 1.04, 9 + j * .8, z, brass);
  }
  // Tubular railings follow the actual hull outline on both sides.
  for (const side of [-1, 1]) {
    const rail = [];
    for (let i = 0; i <= 56; i++) {
      const t = .035 + i / 56 * .93, x = side * hullWidth(t, b * .94), z = (t - .5) * l;
      cylinder(fittings, .065, .075, 1.3, x, 6.7, z, steel, 8);
      rail.push([x, 7.35, z]);
    }
    pipe(fittings, rail, .07, steel, 112, 6);
    pipe(fittings, rail.map(([x, y, z]) => [x, y - .65, z]), .045, steel, 112, 5);
    // Lifebuoys, ventilation cowls and stern depth-charge racks.
    for (const z of [-.17, .035, .15]) {
      const ring = mesh(fittings, new THREE.TorusGeometry(.68, .19, 10, 28), safety, side * b * .34, 9.2, l * z); ring.rotation.y = Math.PI / 2;
    }
    for (let i = 0; i < 3; i++) {
      const z = -l * .32 + i * 1.5;
      const charge = cylinder(fittings, .45, .45, 1.6, side * b * .29, 7, z, charcoal, 24); charge.rotation.z = Math.PI / 2;
    }
    box(fittings, 2.2, .18, 5, side * b * .29, 6.4, -l * .3, steel, .04);
    for (const z of [-.4, .39]) {
      const x = side * hullWidth(z + .5, b * .65);
      box(fittings, 1.5, .2, 2.4, x, 6.3, l * z, charcoal, .08);
      for (const end of [-1, 1]) {
        cylinder(fittings, .22, .28, .9, x, 6.8, l * z + end * .7, steel, 24);
        cylinder(fittings, .34, .34, .15, x, 7.3, l * z + end * .7, steel, 24);
      }
    }
  }
  for (const z of [.39, -.4]) {
    cylinder(fittings, .75, .9, 1.2, 0, 6.8, l * z, paint, 40);
    cylinder(fittings, 1.05, 1.05, .18, 0, 7.5, l * z, charcoal, 40);
  }
  for (const side of [-1, 1]) pipe(fittings, [[side * .6, 6.4, l * .4], [side * 1.1, 6.3, l * .435], [side * 1.6, 6.2, l * .46]], .12, charcoal, 16);
  if (stats.torpedoes) for (const z of [-.02, -.22]) {
    cylinder(fittings, 1.5, 1.7, .5, 0, 9.25, z * l, charcoal, 32);
    for (let i = -1; i <= 1; i++) {
      const tube = cylinder(fittings, .48, .53, 5.7, i * 1.15, 9.8, z * l, paint, 28); tube.rotation.x = Math.PI / 2;
      const cap = mesh(fittings, new THREE.TorusGeometry(.49, .07, 8, 24), charcoal, i * 1.15, 9.8, z * l + 2.85);
      cap.rotation.x = 0;
    }
  }
  // Tripod mast, radar mesh, ladders and rigging.
  cylinder(fittings, .14, .4, 20, 0, 25, l * .075, charcoal, 20);
  for (const side of [-1, 1]) pipe(fittings, [[side * b * .25, 13.8, l * .11], [0, 27, l * .075]], .11, steel, 1, 10);
  for (let i = 0; i < 11; i++) box(fittings, .65, .07, .13, 0, 16 + i * .9, l * .075 + .4, brass);
  box(fittings, b * .76, .18, .24, 0, 28.8, l * .075, charcoal);
  box(fittings, b * .48, .15, .2, 0, 32, l * .075, charcoal);
  for (let i = 0; i < 9; i++) cylinder(fittings, .035, .035, 1.6, -b * .2 + i * b * .05, 32.9, l * .075, steel, 6);
  box(fittings, b * .43, .06, .1, 0, 33.65, l * .075, steel);
  for (const z of [.4, -.4]) pipe(fittings, [[0, 34, l * .075], [0, 7, l * z]], .025, charcoal, 1, 5);
  cylinder(fittings, .1, .16, 7, 0, 9.5, -l * .46, steel, 16);
  batchFittings(fittings);

  const locations = stats.id === 'monarch' ? [.34, .22, -.34] : stats.id === 'resolute' ? [.34, .23, -.24, -.35] : stats.id === 'vanguard' ? [.34, .22, -.34] : [.32, -.34];
  const turrets = locations.map((z, i) => {
    const turret = makeTurret(b, l, stats.id === 'monarch' ? 3 : 2, paint);
    turret.position.set(0, i === 1 && ['monarch', 'vanguard'].includes(stats.id) ? 9.5 : 6.5, z * l);
    if (z < 0) turret.rotation.y = Math.PI;
    ship.add(turret); return turret;
  });
  const flagGeometry = new THREE.PlaneGeometry(4, 2.3, 12, 6), colors = [];
  for (let i = 0; i < flagGeometry.attributes.position.count; i++) {
    const p = flagGeometry.attributes.position;
    const color = new THREE.Color(Math.abs(p.getY(i)) < .22 || Math.abs(p.getX(i) + .55) < .2 ? 0x263c48 : 0xe3bf7b);
    colors.push(color.r, color.g, color.b);
  }
  flagGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const flag = mesh(ship, flagGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1, metalness: 0 }), 2, 11.9, -l * .46);
  let triangles = 0, drawCalls = 0;
  ship.traverse(object => { if (object.isMesh) { triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3; drawCalls++; } });
  ship.userData = { turrets, stats, flag, triangles, drawCalls };
  return ship;
}

export function animateShip(ship, time) {
  const flag = ship.userData.flag;
  if (!flag) return;
  const positions = flag.geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    positions.setZ(i, Math.sin(x * 1.7 - time * 4) * .2 * ((x + 2) / 4));
  }
  positions.needsUpdate = true;
}
