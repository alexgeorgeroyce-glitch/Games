import * as THREE from 'three';
import { SHIPS, ISLANDS } from './data.js';
import { clamp } from './simulation.js';
import { makeShip, animateShip, sharedShipMaterials } from './ships.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const UP = new THREE.Vector3(0, 1, 0);
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .68, metalness: .25, ...extra });
const temp = new THREE.Object3D();
function cylinder(g, r1, r2, h, x, y, z, material, seg = 32) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), material); m.position.set(x, y, z); g.add(m); return m;
}
function islandHeight(t, angle, index, height) {
  const ridge = Math.sin(t * Math.PI) * (.18 * Math.sin(angle * 3 + t * 8 + index) + .055 * Math.sin(angle * 9 - t * 13));
  return Math.pow(Math.max(0, 1 - t), 1.22) * height * (1 + ridge);
}

export class World {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene(); this.scene.fog = new THREE.FogExp2(0x7f9ba6, .00017);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setSize(innerWidth, innerHeight); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.12;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 1, 24000);
    this.scene.add(new THREE.HemisphereLight(0xc7e0eb, 0x344854, 2.3));
    const sun = new THREE.DirectionalLight(0xffd3a2, 3.5); sun.position.set(-1700, 1200, -3500); this.scene.add(sun);
    this.buildSky(); this.buildOcean(); this.buildIslands();
    this.ships = new Map(); this.shots = new Map(); this.effects = [];
    this.target = new THREE.Vector3(); this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    this.waterPlane = new THREE.Plane(UP, 0); this.orbit = -.5; this.elevation = .26; this.zoom = 1;
    this.mode = 'harbor'; this.time = 0; this.showroomShip = null; this.selectShip('kestrel');
    this.camera.position.set(125, 65, 150);
    this.resize = () => { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(innerWidth, innerHeight); };
    window.addEventListener('resize', this.resize);
  }
  buildSky() {
    const material = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: {}, vertexShader: `varying vec3 vPos; void main(){vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`, fragmentShader: `varying vec3 vPos; void main(){vec3 p=normalize(vPos); float h=max(p.y,0.); vec3 c=mix(vec3(.53,.66,.71),vec3(.12,.26,.37),pow(h,.48)); vec3 sun=normalize(vec3(-.35,.14,-.9)); float d=max(dot(p,sun),0.); c+=vec3(1.,.72,.40)*pow(d,18.)*.24; c+=vec3(1.,.85,.62)*pow(d,1600.)*2.; float cloud=sin(p.x*22.+p.z*11.)*sin(p.z*35.-p.x*8.); float band=pow(max(0.,1.-abs(p.y-.12)*7.),3.); c+=vec3(.12)*smoothstep(.1,.75,cloud)*band; gl_FragColor=vec4(c,1.);}` });
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(11000, 40, 20), material));
    // Thin horizon cloud ribbons.
    const clouds = new THREE.Group();
    for (let i = 0; i < 14; i++) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6), new THREE.MeshBasicMaterial({ color: 0xd2d4cd, transparent: true, opacity: .10, depthWrite: false }));
      const a = i * 2.4; mesh.position.set(Math.sin(a) * 6000, 650 + Math.sin(i) * 230, Math.cos(a) * 6000); mesh.scale.set(1100, 65, 290); clouds.add(mesh);
    }
    this.scene.add(clouds);
  }
  buildOcean() {
    this.water = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, sunDir: { value: new THREE.Vector3(-.35, .3, -.9).normalize() } },
      vertexShader: `uniform float time; varying vec3 vWorld; varying vec3 vNormal; void main(){vec3 p=position; vec4 w=modelMatrix*vec4(p,1.); float x=w.x,z=w.z; w.y=sin(x*.014+time*.7)*1.0+sin(z*.019+time*.85)*.65+sin((x+z)*.032+time)*.28; vNormal=normalize(vec3(-.014*cos(x*.014+time*.7)-.009*cos((x+z)*.032+time),1.,-.012*cos(z*.019+time*.85)-.009*cos((x+z)*.032+time))); vWorld=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float time; uniform vec3 sunDir; varying vec3 vWorld; varying vec3 vNormal; void main(){vec3 eye=normalize(cameraPosition-vWorld); float ripple=sin(vWorld.x*.16+sin(vWorld.z*.07+time)*2.+time*1.4)*cos(vWorld.z*.13-time); vec3 n=normalize(vNormal+vec3(ripple*.045,0.,ripple*.06)); float fres=pow(1.-max(dot(eye,n),0.),3.); vec3 c=mix(vec3(.025,.13,.17),vec3(.29,.46,.52),fres*.8); float spec=pow(max(dot(reflect(-sunDir,n),eye),0.),130.); c+=vec3(1.,.79,.49)*spec*.85; float foam=pow(max(0.,sin(vWorld.x*.035+time)*sin(vWorld.z*.055-time*.5)),20.); c+=vec3(.12,.22,.23)*foam*.24; float fog=1.-exp(-length(cameraPosition-vWorld)*.00021); c=mix(c,vec3(.50,.61,.65),fog); gl_FragColor=vec4(c,1.); }` });
    const geo = new THREE.PlaneGeometry(22000, 22000, 280, 280); geo.rotateX(-Math.PI / 2); this.scene.add(new THREE.Mesh(geo, this.water));
    const ringGeo = new THREE.RingGeometry(238, 241, 96); ringGeo.rotateX(-Math.PI / 2);
    this.capRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xe3c28c, transparent: true, opacity: .48, depthWrite: false })); this.capRing.position.y = 2.5; this.capRing.visible = false; this.scene.add(this.capRing);
    this.capBuoys = new THREE.Group();
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; cylinder(this.capBuoys, 1.8, 3, 5, Math.sin(a) * 240, 3, Math.cos(a) * 240, mat(0xe1b165), 8); }
    this.capBuoys.visible = false; this.scene.add(this.capBuoys);
    const marker = new THREE.Group();
    const m = new THREE.Mesh(new THREE.RingGeometry(11, 12.5, 40), new THREE.MeshBasicMaterial({ color: 0xe8bd7d, transparent: true, opacity: .8, depthWrite: false })); m.rotation.x = -Math.PI / 2; marker.add(m);
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(Math.sin(a) * 16, 0, Math.cos(a) * 16), new THREE.Vector3(Math.sin(a) * 25, 0, Math.cos(a) * 25)]), new THREE.LineBasicMaterial({ color: 0xe8bd7d })); marker.add(line);
    }
    marker.visible = false; this.aimMarker = marker; this.scene.add(marker);
  }
  buildIslands() {
    const rockMat = mat(0xffffff, { vertexColors: true, roughness: 1 }), sandMat = mat(0xa2a48c, { roughness: 1 });
    const treeCount = ISLANDS.length * 95;
    const crowns = [[8.5, 18, 10], [6.5, 16, 17], [4.3, 13, 24]].map(([radius, height, y]) => new THREE.ConeGeometry(radius, height, 12, 2).translate(0, y, 0));
    const treeGeometry = mergeGeometries(crowns); crowns.forEach(g => g.dispose());
    const trees = new THREE.InstancedMesh(treeGeometry, mat(0x385448, { roughness: 1 }), treeCount);
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.9, 1.4, 11, 12).translate(0, 5.5, 0), mat(0x5a5647, { roughness: 1 }), treeCount);
    let treeIndex = 0;
    ISLANDS.forEach((island, idx) => {
      const group = new THREE.Group(); group.position.set(island.x, -5, island.z);
      const segments = 96, rings = 32, vertices = [], indices = [], colors = [];
      const low = new THREE.Color(0x657b61), high = new THREE.Color(0x8a9189), color = new THREE.Color();
      for (let r = 0; r <= rings; r++) {
        const t = r / rings;
        for (let i = 0; i <= segments; i++) {
          const a = i / segments * Math.PI * 2;
          const noise = 1 + .10 * Math.sin(a * 5 + idx) + .08 * Math.cos(a * 3 - idx);
          const radius = t * island.r * noise;
          const y = islandHeight(t, a, idx, island.h);
          vertices.push(Math.sin(a) * radius, y, Math.cos(a) * radius);
          color.copy(low).lerp(high, Math.max(0, y / island.h - .22) * 1.25);
          color.multiplyScalar(.95 + .05 * Math.sin(a * 9 + t * 22));
          colors.push(color.r, color.g, color.b);
          if (r < rings && i < segments) { const v = r * (segments + 1) + i; indices.push(v, v + segments + 1, v + 1, v + 1, v + segments + 1, v + segments + 2); }
        }
      }
      const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geom.setIndex(indices); geom.computeVertexNormals();
      group.add(new THREE.Mesh(geom, rockMat));
      const beach = new THREE.Mesh(new THREE.CylinderGeometry(island.r * .92, island.r * 1.06, 5, 96), sandMat); beach.position.y = 3; group.add(beach);
      this.scene.add(group);
      for (let j = 0; j < 95; j++) {
        const a = j * 2.399, t = .22 + ((j * 17) % 54) / 100;
        const radius = t * island.r * (1 + .10 * Math.sin(a * 5 + idx) + .08 * Math.cos(a * 3 - idx));
        const y = islandHeight(t, a, idx, island.h);
        temp.position.set(island.x + Math.sin(a) * radius, y - 5, island.z + Math.cos(a) * radius);
        temp.rotation.y = j * .4; temp.scale.setScalar(.6 + (j % 5) * .12); temp.updateMatrix();
        trees.setMatrixAt(treeIndex, temp.matrix); trunks.setMatrixAt(treeIndex, temp.matrix);
        trees.setColorAt(treeIndex, new THREE.Color().setHSL(.36, .16 + (j % 3) * .025, .20 + (j % 4) * .025));
        treeIndex++;
      }
    });
    this.scene.add(trees, trunks);
  }
  disposeObject(object) {
    object.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && !sharedShipMaterials.has(o.material)) o.material.dispose();
    });
    this.scene.remove(object);
  }
  selectShip(type) {
    if (this.showroomShip) this.disposeObject(this.showroomShip);
    this.showroomShip = makeShip(type); this.showroomShip.rotation.y = -.55; this.scene.add(this.showroomShip);
  }
  startBattle(battle) {
    this.mode = 'battle'; this.showroomShip.visible = false; this.capRing.visible = this.capBuoys.visible = this.aimMarker.visible = true;
    for (const mesh of this.ships.values()) this.disposeObject(mesh); this.ships.clear();
    for (const s of battle.ships) {
      const mesh = makeShip(s.type); this.ships.set(s.id, mesh); this.scene.add(mesh);
      const wakeGeo = new THREE.BufferGeometry(); wakeGeo.setAttribute('position', new THREE.Float32BufferAttribute([-3, 0, 0, -14, 0, -120, 14, 0, -120, -3, 0, 0, 14, 0, -120, 3, 0, 0], 3));
      const wake = new THREE.Mesh(wakeGeo, new THREE.MeshBasicMaterial({ color: 0xc3e0dc, transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false }));
      wake.position.set(0, 1.7, -s.stats.length * .45); mesh.add(wake); mesh.userData.wake = wake;
    }
    this.orbit = 0; this.elevation = .25; this.zoom = 1; this.syncShips(battle, 0);
    this.camera.position.set(battle.player.x, 108, battle.player.z + 220); this.target.set(battle.player.x, 8, battle.player.z - 80);
  }
  harbor() {
    this.mode = 'harbor'; this.showroomShip.visible = true; this.capRing.visible = this.capBuoys.visible = this.aimMarker.visible = false;
    for (const mesh of this.ships.values()) this.disposeObject(mesh); this.ships.clear();
    for (const m of this.shots.values()) this.disposeObject(m); this.shots.clear();
    for (const e of this.effects) this.disposeObject(e.mesh); this.effects = [];
  }
  syncShips(battle, dt) {
    for (const s of battle.ships) {
      const mesh = this.ships.get(s.id);
      animateShip(mesh, this.time);
      mesh.position.set(s.x, Math.sin(this.time * 1.6 + s.id) * .55 - Math.min(18, s.deadTime * 2), s.z);
      mesh.rotation.set(Math.sin(this.time * .8 + s.id) * .012, s.heading, Math.sin(this.time + s.id) * .015 + (s.dead ? Math.min(.6, s.deadTime * .06) : 0));
      mesh.visible = s.deadTime < 12;
      for (const turret of mesh.userData.turrets) turret.rotation.y = s.gunAngle - s.heading;
      mesh.userData.wake.material.opacity = s.dead ? 0 : Math.min(.18, Math.abs(s.speed) * .005);
      mesh.userData.wake.scale.set(1 + Math.sin(this.time * 3) * .08, 1, Math.max(.01, Math.abs(s.speed) / 30));
      if (!s.dead && s.hull < s.stats.hull * .4 && Math.random() < dt * 5) this.effect(s.x, s.z, 'smoke');
    }
    const active = new Set();
    for (const p of battle.projectiles) {
      active.add(p.id);
      if (!this.shots.has(p.id)) {
        const mesh = new THREE.Mesh(p.torpedo ? new THREE.CapsuleGeometry(.8, 5, 8, 16) : new THREE.SphereGeometry(1.1, 16, 12), new THREE.MeshBasicMaterial({ color: p.torpedo ? 0xcbe5e0 : 0xffd38b }));
        if (p.torpedo) mesh.rotation.x = Math.PI / 2;
        this.scene.add(mesh); this.shots.set(p.id, mesh);
      }
      this.shots.get(p.id).position.set(p.x, p.y, p.z);
    }
    for (const [id, mesh] of this.shots) if (!active.has(id)) { this.disposeObject(mesh); this.shots.delete(id); }
    this.aimMarker.position.set(battle.aim.x, 3, battle.aim.z);
    this.capRing.material.color.setHex(battle.contested ? 0xeb816e : battle.capture > 0 ? 0x70c8be : 0xe3c28c);
  }
  effect(x, z, type = 'splash') {
    const smoke = type === 'smoke', fire = type === 'fire', large = type === 'explosion';
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color: smoke ? 0x343b3d : fire || large ? 0xffbe66 : 0xb6d8db, transparent: true, opacity: smoke ? .28 : .8, depthWrite: false }));
    mesh.position.set(x, smoke ? 20 : 3, z); this.scene.add(mesh); this.effects.push({ mesh, life: 0, duration: smoke ? 4 : large ? 1.5 : 1, smoke, fire, large });
    if (this.effects.length > 100) this.disposeObject(this.effects.shift().mesh);
  }
  aimAt(clientX, clientY, battle) {
    this.pointer.set(clientX / innerWidth * 2 - 1, -(clientY / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const point = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.waterPlane, point)) {
      const p = battle.player, dx = point.x - p.x, dz = point.z - p.z, dist = Math.hypot(dx, dz);
      battle.aim = { x: p.x + dx * Math.min(1, 1850 / dist), z: p.z + dz * Math.min(1, 1850 / dist) };
    }
  }
  project(x, y, z) {
    const point = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (point.x * .5 + .5) * innerWidth, y: (-point.y * .5 + .5) * innerHeight, visible: point.z < 1 && point.z > -1 && Math.abs(point.x) < 1 && Math.abs(point.y) < 1 };
  }
  update(dt, battle, paused = false) {
    this.time += dt; this.water.uniforms.time.value = this.time;
    if (this.mode === 'harbor') {
      const compact = innerWidth < 900;
      const angle = .67 + Math.sin(this.time * .035) * .13;
      const radius = compact ? 260 : 148;
      const desired = new THREE.Vector3(Math.sin(angle) * radius, compact ? 70 : 65, Math.cos(angle) * radius);
      this.camera.position.lerp(desired, Math.min(1, dt * 2));
      this.target.lerp(new THREE.Vector3(compact ? -15 : 10, 6, compact ? 12 : 0), Math.min(1, dt * 2));
      animateShip(this.showroomShip, this.time);
      this.showroomShip.position.y = Math.sin(this.time * .9) * .6;
      this.showroomShip.rotation.z = Math.sin(this.time * .65) * .013;
    } else if (battle) {
      this.syncShips(battle, paused ? 0 : dt);
      const p = battle.player;
      const angle = p.heading + Math.PI + this.orbit;
      const radius = 220 * this.zoom;
      const desired = new THREE.Vector3(p.x + Math.sin(angle) * radius, 55 + 170 * this.elevation * this.zoom, p.z + Math.cos(angle) * radius);
      this.camera.position.lerp(desired, Math.min(1, dt * 4));
      this.target.lerp(new THREE.Vector3(p.x + Math.sin(p.heading) * 80, 8, p.z + Math.cos(p.heading) * 80), Math.min(1, dt * 4));
    }
    this.camera.lookAt(this.target);
    for (const e of this.effects) {
      e.life += dt; const t = e.life / e.duration;
      e.mesh.scale.setScalar(e.smoke ? 8 + t * 25 : e.fire ? 4 + t * 10 : e.large ? 10 + t * 26 : 2 + t * 12);
      if (!e.smoke && !e.fire && !e.large) e.mesh.scale.y = 2.5 * (1 - t) + .3;
      e.mesh.position.y += dt * (e.smoke ? 8 : e.large ? 6 : 2);
      e.mesh.material.opacity = Math.max(0, (e.smoke ? .28 : .8) * (1 - t));
    }
    this.effects = this.effects.filter(e => { if (e.life > e.duration) { this.disposeObject(e.mesh); return false; } return true; });
    this.renderer.render(this.scene, this.camera);
  }
}
