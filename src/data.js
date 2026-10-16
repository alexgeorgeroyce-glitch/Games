export const SHIPS = [
  { id: 'kestrel', name: 'Kestrel', prefix: 'ITS', role: 'Coastal destroyer', rank: 'I', year: '1936', cost: 0, hull: 1200, speed: 34, turn: .40, reload: 3.6, damage: 210, guns: 4, caliber: '120 mm', torpedoes: 6, length: 66, beam: 8, color: 0x859299, description: 'Fast on the helm. First into the fight. A versatile destroyer with a lethal torpedo broadside.' },
  { id: 'vanguard', name: 'Vanguard', prefix: 'ITS', role: 'Fleet destroyer', rank: 'II', year: '1941', cost: 600, hull: 1700, speed: 38, turn: .36, reload: 3.4, damage: 270, guns: 6, caliber: '127 mm', torpedoes: 8, length: 78, beam: 9, color: 0x7b8a85, description: 'Built to hunt. Twin gun mounts and upgraded torpedoes make Vanguard a formidable escort.' },
  { id: 'resolute', name: 'Resolute', prefix: 'ITS', role: 'Light cruiser', rank: 'III', year: '1943', cost: 1500, hull: 2700, speed: 29, turn: .25, reload: 4.5, damage: 440, guns: 8, caliber: '152 mm', torpedoes: 4, length: 100, beam: 13, color: 0x969c96, description: 'Hold the line. Eight rapid-firing guns and reinforced armor bring cruiser firepower to the fleet.' },
  { id: 'monarch', name: 'Monarch', prefix: 'ITS', role: 'Battleship', rank: 'IV', year: '1945', cost: 3000, hull: 4300, speed: 23, turn: .18, reload: 6, damage: 750, guns: 9, caliber: '305 mm', torpedoes: 0, length: 124, beam: 19, color: 0x8e969e, description: 'Command the horizon. Heavy triple turrets deliver devastating salvos from an armored fortress.' },
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
    const unlocked = ['kestrel', ...p.unlocked.filter(id => SHIPS.some(s => s.id === id) && id !== 'kestrel')];
    return { ...freshProfile(), ...p, unlocked, selected: unlocked.includes(p.selected) ? p.selected : 'kestrel' };
  } catch { return freshProfile(); }
}
export function unlockShip(profile, id) {
  const ship = SHIPS.find(s => s.id === id);
  if (!ship || profile.unlocked.includes(id)) return false;
  const index = SHIPS.indexOf(ship);
  if (!profile.unlocked.includes(SHIPS[index - 1]?.id) || profile.credits < ship.cost) return false;
  profile.credits -= ship.cost;
  profile.unlocked.push(id);
  return true;
}
export const rewardFor = (result, kills, damage, capture) => Math.round(120 + (result === 'victory' ? 320 : 0) + kills * 100 + damage * .08 + capture * 2);
