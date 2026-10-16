import { SHIPS, ISLANDS } from './data.js';
import { batterySolution, muzzlePosition, updateBatteryReload } from './weapons.js';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const headingTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);

export class Battle {
  constructor(id = 'kestrel', difficulty = 'standard') {
    this.time = 0; this.elapsed = 0; this.duration = 300; this.difficulty = difficulty;
    this.ships = []; this.projectiles = []; this.events = []; this.result = null;
    this.capture = 0; this.enemyCapture = 0; this.kills = 0; this.damage = 0; this.capSeconds = 0;
    this.player = this.addShip(id, 0, -40, 950, Math.PI, 'player', 'YOU');
    this.addShip('kestrel', 0, -280, 1050, Math.PI, 'ally', 'ITS Ardent');
    let enemies = difficulty === 'cadet' ? ['kestrel', 'kestrel', 'vanguard'] : difficulty === 'veteran' ? ['vanguard', 'resolute', 'kestrel', 'vanguard'] : ['kestrel', 'vanguard', 'kestrel'];
    if (this.player.stats.level >= 4) enemies = difficulty === 'cadet' ? ['vanguard', 'resolute', 'monarch'] : difficulty === 'veteran' ? ['sentinel', 'sovereign', id, 'tempest'] : ['bastion', id, 'tempest'];
    enemies.forEach((ship, i) => this.addShip(ship, 1, -320 + i * 310, -850 - (i % 2) * 200, 0, 'enemy', ['RNS Viper', 'RNS Tempest', 'RNS Jackal', 'RNS Reaver'][i]));
    this.aim = { x: 0, z: -700 };
    this.input = { throttle: 0, steer: 0, fire: false };
    this.serial = 0;
  }
  addShip(type, team, x, z, heading, role, name) {
    const stats = SHIPS.find(s => s.id === type) || SHIPS[0];
    const ship = { id: this.ships.length, type, team, x, z, heading, role, name, stats, hull: stats.hull, speed: 0, throttle: 0, reload: 0, torpedoReload: 0, torpedoes: stats.torpedoes, repairs: 2, repairTime: 0, dead: false, deadTime: 0, aiTimer: 2 + this.ships.length * 1.2, gunAngle: heading };
    ship.mounts = stats.mounts.map(() => ({ reload: 0 }));
    ship.aim = { x: x + Math.sin(heading) * 1000, z: z + Math.cos(heading) * 1000 };
    this.ships.push(ship); return ship;
  }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
  fire(ship, target, torpedo = false) {
    if (this.result || ship.dead || !Number.isFinite(target.x) || !Number.isFinite(target.z)) return false;
    const dist = distance(ship, target);
    if (!torpedo && dist > ship.stats.range) return false;
    ship.aim = { x: target.x, z: target.z };
    if (torpedo) {
      if (ship.torpedoReload > 0 || ship.torpedoes <= 0) return false;
      ship.torpedoes--; ship.torpedoReload = 14;
      const angle = headingTo(ship, target);
      this.projectiles.push({ id: this.serial++, owner: ship.id, team: ship.team, torpedo: true, x: ship.x, z: ship.z, sx: ship.x, sz: ship.z, tx: target.x, tz: target.z, y: 1, life: 0, duration: 24, vx: Math.sin(angle) * 110, vz: Math.cos(angle) * 110, damage: 950 });
      this.emit('fire', { ship, torpedo: true }); return true;
    }
    const solution = batterySolution(ship, target);
    const firing = solution.mounts.filter(mount => mount.ready);
    if (!firing.length) { updateBatteryReload(ship); return false; }
    let guns = 0;
    for (const mount of firing) {
      ship.mounts[mount.index].reload = ship.stats.reload;
      for (let barrel = 0; barrel < mount.count; barrel++) {
        const muzzle = muzzlePosition(ship, mount, barrel);
        const offset = (barrel - (mount.count - 1) / 2) * 2;
        const angle = headingTo(muzzle, target);
        const end = { x: target.x + Math.cos(angle) * offset, z: target.z - Math.sin(angle) * offset };
        this.projectiles.push({ id: this.serial++, owner: ship.id, team: ship.team, torpedo: false, mount: mount.index, barrel,
          x: muzzle.x, z: muzzle.z, sx: muzzle.x, sz: muzzle.z, sy: muzzle.y, tx: end.x, tz: end.z, y: muzzle.y, life: 0,
          duration: Math.max(.3, distance(muzzle, end) / (500 + ship.stats.caliberMm * .35)), damage: ship.stats.shellDamage });
        guns++;
      }
    }
    updateBatteryReload(ship);
    this.emit('fire', { ship, torpedo: false, guns, broadside: guns === ship.stats.guns, side: solution.side, damage: guns * ship.stats.shellDamage, mounts: firing });
    return true;
  }
  repair() {
    const p = this.player;
    if (this.result || p.dead || p.repairs <= 0 || p.repairTime > 0 || p.hull >= p.stats.hull) return false;
    p.repairs--; p.repairTime = 8; this.emit('repair'); return true;
  }
  hit(target, amount, owner) {
    if (target.dead) return;
    const actual = Math.min(target.hull, amount);
    target.hull -= amount;
    if (owner === this.player.id && target.team !== this.player.team) this.damage += actual;
    this.emit('hit', { ship: target, damage: Math.round(actual), playerHit: owner === this.player.id });
    if (target.hull <= 0) {
      target.hull = 0; target.dead = true;
      if (owner === this.player.id && target.team !== this.player.team) this.kills++;
      this.emit('sunk', { ship: target });
    }
  }
  step(dt) {
    if (this.result) return;
    dt = Math.min(dt, .1); this.time += dt; this.elapsed += dt;
    for (const s of this.ships) {
      if (s.dead) { s.deadTime += dt; continue; }
      for (const mount of s.mounts) mount.reload = Math.max(0, mount.reload - dt);
      updateBatteryReload(s); s.torpedoReload = Math.max(0, s.torpedoReload - dt);
      if (s.repairTime > 0) {
        const repairStep = Math.min(dt, s.repairTime);
        s.repairTime = Math.max(0, s.repairTime - dt);
        s.hull = Math.min(s.stats.hull, s.hull + s.stats.hull * .045 * repairStep);
      }
      let steer = 0;
      if (s.role === 'player') {
        s.throttle = clamp(s.throttle + this.input.throttle * dt * .32, -.35, 1);
        steer = this.input.steer;
        s.aim = { ...this.aim }; s.gunAngle = headingTo(s, this.aim);
        if (this.input.fire) this.fire(s, this.aim);
      } else {
        const targets = this.ships.filter(t => !t.dead && t.team !== s.team).sort((a, b) => distance(s, a) - distance(s, b));
        const target = targets[0];
        if (target) {
          const d = distance(s, target);
          let desired = headingTo(s, d > 1050 ? { x: target.x * .4, z: target.z * .4 } : target);
          if (d < 1250) desired = headingTo(s, target) + (s.id % 2 ? 1.4 : -1.4);
          // Push away from island shorelines before steering toward a target.
          for (const island of ISLANDS) {
            if (distance(s, island) < island.r + 145) desired = headingTo(island, s);
          }
          steer = clamp(angleDelta(desired, s.heading) * 2, -1, 1);
          s.throttle = d < 450 ? .35 : .78;
          s.gunAngle = headingTo(s, target);
          const lead = d / (500 + s.stats.caliberMm * .35);
          s.aim = { x: target.x + Math.sin(target.heading) * target.speed * lead, z: target.z + Math.cos(target.heading) * target.speed * lead };
          s.aiTimer -= dt;
          if (s.aiTimer <= 0 && d < s.stats.range - 100) {
            const flight = d / 520;
            const spread = this.difficulty === 'cadet' ? 110 : this.difficulty === 'veteran' ? 25 : 70;
            this.fire(s, { x: target.x + Math.sin(target.heading) * target.speed * flight + Math.sin(this.time * 2 + s.id) * spread, z: target.z + Math.cos(target.heading) * target.speed * flight + Math.cos(this.time * 1.7 + s.id) * spread });
            s.aiTimer = s.stats.reload + (s.team === 0 ? 1 : this.difficulty === 'cadet' ? 5 : 2);
          }
        }
      }
      s.speed += (s.throttle * s.stats.speed * 1.4 - s.speed) * Math.min(1, dt * .65);
      s.heading += steer * s.stats.turn * dt * (.25 + Math.min(1, Math.abs(s.speed) / 16));
      const nx = s.x + Math.sin(s.heading) * s.speed * dt, nz = s.z + Math.cos(s.heading) * s.speed * dt;
      if (ISLANDS.some(i => Math.hypot(nx - i.x, nz - i.z) < i.r * .78 + 20)) {
        s.speed *= -.15; s.throttle = 0;
        if (s.role === 'player' && (!s.lastCollision || this.time - s.lastCollision > 3)) { this.emit('collision'); s.lastCollision = this.time; }
      } else { s.x = clamp(nx, -2350, 2350); s.z = clamp(nz, -2350, 2350); }
    }
    for (const s of this.ships) if (!s.dead) updateBatteryReload(s);
    for (const p of this.projectiles) {
      p.life += dt;
      if (p.torpedo) {
        p.x += p.vx * dt; p.z += p.vz * dt;
        const target = this.ships.find(s => !s.dead && s.team !== p.team && distance(s, p) < s.stats.length * .35 + 12);
        if (target) { this.hit(target, p.damage, p.owner); p.done = true; this.emit('splash', { x: p.x, z: p.z, large: true }); }
      } else {
        const t = Math.min(1, p.life / p.duration);
        p.x = p.sx + (p.tx - p.sx) * t; p.z = p.sz + (p.tz - p.sz) * t;
        p.y = p.sy * (1 - t) + Math.sin(t * Math.PI) * Math.min(140, p.duration * 50);
        if (t >= 1) {
          const target = this.ships.filter(s => !s.dead && s.team !== p.team && distance(s, p) < 42 + s.stats.beam).sort((a, b) => distance(a, p) - distance(b, p))[0];
          if (target) this.hit(target, p.damage, p.owner);
          this.emit('splash', { x: p.x, z: p.z, large: !!target }); p.done = true;
        }
      }
      if (ISLANDS.some(i => distance(p, i) < i.r * .7) && (p.torpedo || p.y < 55)) { p.done = true; this.emit('splash', { x: p.x, z: p.z }); }
      if (p.life > p.duration) p.done = true;
    }
    this.projectiles = this.projectiles.filter(p => !p.done);
    const atCap = this.ships.filter(s => !s.dead && Math.hypot(s.x, s.z) < 245);
    const friendly = atCap.some(s => s.team === 0), hostile = atCap.some(s => s.team === 1);
    if (friendly && !hostile) { this.capture = Math.min(100, this.capture + dt * 1.9); this.capSeconds += dt; }
    if (hostile && !friendly) this.enemyCapture = Math.min(100, this.enemyCapture + dt * 1.1);
    this.contested = friendly && hostile;
    if (this.player.dead || this.enemyCapture >= 100) this.finish('defeat');
    else if (this.capture >= 100 || this.ships.filter(s => s.team === 1).every(s => s.dead)) this.finish('victory');
    else if (this.time >= this.duration) this.finish(this.capture > this.enemyCapture ? 'victory' : 'defeat');
  }
  finish(result) { if (!this.result) { this.result = result; this.emit('end', { result }); } }
}
