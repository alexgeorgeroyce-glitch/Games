import { createBatteryLayout, damageForCaliber } from './weapons.js';

function vessel(spec) {
  const stats = { prefix: 'ITS', foreTurrets: 1, aftTurrets: 1, barrels: 2, family: 'destroyers', ...spec };
  stats.guns = (stats.foreTurrets + stats.aftTurrets) * stats.barrels;
  stats.caliber = `${stats.caliberMm} mm`;
  stats.shellDamage = damageForCaliber(stats.caliberMm);
  stats.damage = stats.guns * stats.shellDamage;
  stats.range = stats.caliberMm >= 280 ? 2500 : stats.caliberMm >= 180 ? 2200 : 1900;
  stats.mounts = createBatteryLayout(stats);
  return stats;
}

export const SHIPS = [
  vessel({ id: 'kestrel', name: 'Kestrel', role: 'Coastal destroyer', rank: 'I', level: 1, year: '1936', cost: 0, requires: null, hull: 1200, speed: 34, turn: .40, reload: 3.6, caliberMm: 120, torpedoes: 6, length: 76, beam: 8, color: 0x859299, description: 'Fast on the helm. Turn your flank toward the enemy to bring both twin turrets into action.' }),
  vessel({ id: 'vanguard', name: 'Vanguard', role: 'Fleet destroyer', rank: 'II', level: 2, year: '1941', cost: 600, requires: 'kestrel', hull: 1700, speed: 38, turn: .36, reload: 3.8, caliberMm: 127, foreTurrets: 2, torpedoes: 8, length: 96, beam: 9, color: 0x7b8a85, description: 'Three twin mounts, a superfiring bow battery, and a formidable torpedo armament.' }),
  vessel({ id: 'resolute', name: 'Resolute', family: 'cruisers', role: 'Light cruiser', rank: 'III', level: 3, year: '1943', cost: 1500, requires: 'kestrel', hull: 3000, speed: 29, turn: .25, reload: 5, caliberMm: 152, foreTurrets: 2, aftTurrets: 2, torpedoes: 4, length: 128, beam: 13, color: 0x969c96, description: 'Eight 152 mm guns in four separated turrets. A full broadside rewards careful positioning.' }),
  vessel({ id: 'monarch', name: 'Monarch', family: 'capital', role: 'Battleship', rank: 'IV', level: 4, year: '1945', cost: 3000, requires: 'resolute', hull: 6500, speed: 23, turn: .18, reload: 8, caliberMm: 305, foreTurrets: 2, barrels: 3, torpedoes: 0, length: 154, beam: 19, color: 0x8e969e, description: 'Nine heavy rifles. Bow-on attacks use six; turn to port or starboard to unleash all nine.' }),
  vessel({ id: 'tempest', name: 'Tempest', role: 'Leader destroyer', rank: 'III', level: 3, year: '1944', cost: 1400, requires: 'vanguard', hull: 2200, speed: 39, turn: .34, reload: 4, caliberMm: 130, foreTurrets: 2, aftTurrets: 2, torpedoes: 10, length: 112, beam: 10, color: 0x738c91, description: 'Eight guns and ten torpedoes on a fast, long hull. An aggressive flanking specialist.' }),
  vessel({ id: 'phantom', name: 'Phantom', role: 'Heavy destroyer', rank: 'IV', level: 4, year: '1947', cost: 2800, requires: 'tempest', hull: 2900, speed: 41, turn: .33, reload: 4.2, caliberMm: 138, foreTurrets: 2, aftTurrets: 2, torpedoes: 12, length: 122, beam: 11, color: 0x677d82, description: 'The destroyer branch culminates in a swift eight-gun raider with twelve torpedoes.' }),
  vessel({ id: 'bastion', name: 'Bastion', family: 'cruisers', role: 'Armored cruiser', rank: 'IV', level: 4, year: '1946', cost: 2800, requires: 'resolute', hull: 4400, speed: 30, turn: .23, reload: 5.5, caliberMm: 180, foreTurrets: 2, aftTurrets: 2, torpedoes: 6, length: 142, beam: 15, color: 0x7e8f88, description: 'Thicker armor and larger 180 mm shells give the cruiser branch a harder punch.' }),
  vessel({ id: 'sentinel', name: 'Sentinel', family: 'cruisers', role: 'Heavy cruiser', rank: 'V', level: 5, year: '1948', cost: 4200, requires: 'bastion', hull: 5800, speed: 31, turn: .21, reload: 6.2, caliberMm: 203, foreTurrets: 2, aftTurrets: 2, barrels: 3, torpedoes: 4, length: 158, beam: 17, color: 0x8b919c, description: 'Twelve 203 mm guns deliver the heaviest cruiser broadside yet. Keep every turret unmasked.' }),
  vessel({ id: 'valiant', name: 'Valiant', family: 'cruisers', role: 'Large cruiser', rank: 'VI', level: 6, year: '1950', cost: 6200, requires: 'sentinel', hull: 7600, speed: 32, turn: .19, reload: 7, caliberMm: 254, foreTurrets: 2, aftTurrets: 2, barrels: 3, torpedoes: 0, length: 178, beam: 20, color: 0x7d929b, description: 'Cruiser speed meets 254 mm firepower. Twelve rifles make either flank a dangerous place.' }),
  vessel({ id: 'sovereign', name: 'Sovereign', family: 'capital', role: 'Fast battleship', rank: 'V', level: 5, year: '1948', cost: 5000, requires: 'monarch', hull: 8800, speed: 27, turn: .16, reload: 9, caliberMm: 356, foreTurrets: 2, aftTurrets: 2, barrels: 3, torpedoes: 0, length: 182, beam: 23, color: 0x85948d, description: 'Four triple turrets and a longer armored hull. A twelve-gun broadside commands the channel.' }),
  vessel({ id: 'leviathan', name: 'Leviathan', family: 'capital', role: 'Heavy battleship', rank: 'VI', level: 6, year: '1951', cost: 7500, requires: 'sovereign', hull: 11200, speed: 25, turn: .14, reload: 10, caliberMm: 406, foreTurrets: 2, aftTurrets: 2, barrels: 3, torpedoes: 0, length: 204, beam: 27, color: 0x788c98, description: 'Twelve 406 mm guns behind deep armor belts. Slow to turn, devastating when brought broadside.' }),
  vessel({ id: 'dreadnought', name: 'Dreadnought', family: 'capital', role: 'Super battleship', rank: 'VII', level: 7, year: '1954', cost: 10500, requires: 'leviathan', hull: 14500, speed: 24, turn: .12, reload: 11.5, caliberMm: 460, foreTurrets: 2, aftTurrets: 2, barrels: 3, torpedoes: 0, length: 228, beam: 30, color: 0x8b9093, description: 'The ultimate Aurelian capital ship. Twelve 460 mm rifles deliver an enormous, slow-reloading broadside.' }),
];

export const TECH_BRANCHES = [
  { id: 'destroyers', name: 'DESTROYER FLOTILLA', subtitle: 'Speed, maneuverability & torpedoes', ships: ['kestrel', 'vanguard', 'tempest', 'phantom'] },
  { id: 'cruisers', name: 'CRUISER SQUADRON', subtitle: 'Balanced armor & sustained broadside fire', ships: ['resolute', 'bastion', 'sentinel', 'valiant'] },
  { id: 'capital', name: 'CAPITAL FLEET', subtitle: 'Heavy armor & increasing gun caliber', ships: ['monarch', 'sovereign', 'leviathan', 'dreadnought'] },
];

export const ISLANDS = [
  { x: -570, z: -100, r: 180, h: 115 }, { x: 610, z: 170, r: 205, h: 155 },
  { x: -950, z: -1150, r: 300, h: 230 }, { x: 1050, z: -1350, r: 350, h: 240 },
  { x: -1650, z: 650, r: 360, h: 240 }, { x: 1600, z: 800, r: 260, h: 160 },
  { x: -300, z: -2000, r: 230, h: 140 },
];

export const freshProfile = () => ({ credits: 0, unlocked: ['kestrel'], selected: 'kestrel', battles: 0, victories: 0, bestKills: 0 });
export function readProfile(storage = globalThis.localStorage) {
  try {
    const p = JSON.parse(storage.getItem('iron-tide-profile-v1'));
    if (!p || !Number.isFinite(p.credits) || p.credits < 0 || !Array.isArray(p.unlocked)) return freshProfile();
    const unlocked = [...new Set(['kestrel', ...p.unlocked.filter(id => SHIPS.some(s => s.id === id))])];
    return { ...freshProfile(), ...p, unlocked, selected: unlocked.includes(p.selected) ? p.selected : 'kestrel' };
  } catch { return freshProfile(); }
}
export function unlockShip(profile, id) {
  const ship = SHIPS.find(s => s.id === id);
  if (!ship || profile.unlocked.includes(id) || !profile.unlocked.includes(ship.requires) || profile.credits < ship.cost) return false;
  profile.credits -= ship.cost; profile.unlocked.push(id); return true;
}
export const rewardFor = (result, kills, damage, capture) => Math.round(120 + (result === 'victory' ? 320 : 0) + kills * 100 + damage * .08 + capture * 2);
