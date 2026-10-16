export const wrapAngle = value => Math.atan2(Math.sin(value), Math.cos(value));
export const damageForCaliber = caliberMm => Math.round(52.5 * Math.pow(caliberMm / 120, 1.55));

// One layout defines collision clearances, rendered mounts and actual firing positions.
export function createBatteryLayout(stats) {
  const { foreTurrets = 1, aftTurrets = 1, barrels = 2 } = stats;
  const beam = stats.beam * 1.6;
  const width = Math.min(beam * .42, 4.1 + barrels * 1.1 + stats.caliberMm * .012);
  const depth = width * .94;
  const barrelLength = 6 + stats.caliberMm * .025;
  const layout = [];
  for (const [end, count] of [[1, foreTurrets], [-1, aftTurrets]]) {
    for (let i = 0; i < count; i++) {
      // Outer mount first; inner mounts superfire above it.
      const station = count === 1 ? .35 : i === 0 ? .395 : .235;
      layout.push({
        id: layout.length, count: barrels, x: 0, z: end * station * stats.length,
        deckY: i === 0 ? 6.5 : 11.4, home: end === 1 ? 0 : Math.PI,
        arc: 110 * Math.PI / 180, width, depth, roof: 5.3, bore: 3.35,
        barrelLength, muzzleOffset: depth * .3 + barrelLength,
        barrelRadius: .24 * Math.pow(stats.caliberMm / 120, .7),
        spacing: width * .8 / (barrels + 1),
      });
    }
  }
  return layout;
}

export function mountPosition(ship, mount) {
  return {
    x: ship.x + Math.cos(ship.heading) * mount.x + Math.sin(ship.heading) * mount.z,
    z: ship.z - Math.sin(ship.heading) * mount.x + Math.cos(ship.heading) * mount.z,
  };
}

export function batterySolution(ship, target) {
  const layout = ship.stats.mounts;
  const relative = wrapAngle(Math.atan2(target.x - ship.x, target.z - ship.z) - ship.heading);
  const mounts = layout.map((mount, index) => {
    const position = mountPosition(ship, mount);
    const bearing = Math.atan2(target.x - position.x, target.z - position.z);
    const offset = wrapAngle(bearing - ship.heading - mount.home);
    const inArc = Math.abs(offset) <= mount.arc + 1e-8;
    const reload = ship.mounts?.[index]?.reload ?? 0;
    return { ...mount, index, position, inArc, ready: inArc && reload <= 0, reload, yaw: inArc ? wrapAngle(bearing - ship.heading) : mount.home };
  });
  const guns = mounts.filter(m => m.inArc).reduce((sum, m) => sum + m.count, 0);
  const readyGuns = mounts.filter(m => m.ready).reduce((sum, m) => sum + m.count, 0);
  const side = relative < 0 ? 'STARBOARD' : 'PORT';
  return { mounts, guns, readyGuns, totalGuns: ship.stats.guns, damage: guns * ship.stats.shellDamage,
    readyDamage: readyGuns * ship.stats.shellDamage, broadside: guns === ship.stats.guns, side,
    label: guns === ship.stats.guns ? `${side} BROADSIDE` : Math.cos(relative) >= 0 ? 'BOW BATTERY' : 'STERN BATTERY' };
}

export function muzzlePosition(ship, mount, barrel) {
  const yaw = ship.heading + mount.yaw;
  const offset = (barrel - (mount.count - 1) / 2) * mount.spacing;
  return {
    x: mount.position.x + Math.cos(yaw) * offset + Math.sin(yaw) * mount.muzzleOffset,
    y: mount.deckY + mount.bore,
    z: mount.position.z - Math.sin(yaw) * offset + Math.cos(yaw) * mount.muzzleOffset,
  };
}

export function updateBatteryReload(ship) {
  const target = ship.aim;
  let reload = Infinity;
  const sin = Math.sin(ship.heading), cos = Math.cos(ship.heading);
  for (const [i, mount] of ship.stats.mounts.entries()) {
    const x = ship.x + cos * mount.x + sin * mount.z;
    const z = ship.z - sin * mount.x + cos * mount.z;
    const offset = wrapAngle(Math.atan2(target.x - x, target.z - z) - ship.heading - mount.home);
    if (Math.abs(offset) <= mount.arc + 1e-8) reload = Math.min(reload, ship.mounts[i].reload);
  }
  ship.reload = Number.isFinite(reload) ? reload : 0;
}
