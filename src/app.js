import './style.css';
import { SHIPS, ISLANDS, readProfile, unlockShip, rewardFor } from './data.js';
import { Battle, clamp, distance } from './simulation.js';
import { World } from './world.js';
import { NavalAudio } from './audio.js';

const icons = {
 anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14m-5-10h10M4 14a8 8 0 0 0 16 0M1 16l3-3 3 3m10 0 3-3 3 3"/>',
 compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',
 ship: '<path d="m3 15 9-3 9 3-3 6H6Z M7 13V7h10v6M10 7V3h4v4M1 22h22"/>',
 arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
 lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
 check: '<path d="m5 12 4 4L19 6"/>',
 target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v5m0 12v5M1 12h5m12 0h5"/>',
 chevron: '<path d="m9 5 7 7-7 7"/>',
 shield: '<path d="m12 2 8 3v7c0 5-8 10-8 10S4 17 4 12V5Z"/><path d="m8 12 3 3 5-6"/>',
 bolt: '<path d="m14 2-9 12h7l-2 8 9-12h-7Z"/>',
 gun: '<path d="M3 18h18v3H3zM6 18v-7h12v7M12 11V3m-3 0h6M7 7h10"/>',
 waves: '<path d="M2 8q3-4 6 0t6 0t8 0M2 14q3-4 6 0t6 0t8 0M2 20q3-4 6 0t6 0t8 0"/>',
 volume: '<path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
 mute: '<path d="m11 4-6 5H2v6h3l6 5ZM16 9l6 6m0-6-6 6"/>',
 close: '<path d="m6 6 12 12M18 6 6 18"/>',
 expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
 trophy: '<path d="M7 3h10v6a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 14v5m-5 2h10"/>',
 info: '<circle cx="12" cy="12" r="9"/><path d="M12 10v7m0-11v1"/>',
 wrench: '<path d="M14 3a6 6 0 0 0-7 7L2 16a3 3 0 0 0 4 4l7-7a6 6 0 0 0 8-7l-4 4-4-3Z"/>',
 pause: '<path d="M8 5v14M16 5v14"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.ship}</svg>`;
const silhouette = (index, cls = '') => `<svg class="silhouette ${cls}" viewBox="0 0 220 65" fill="currentColor" aria-hidden="true"><path d="M9 47h18v-6h22v-5h17v-8h17V17h4V8h2v9h16v3H89v8h17v7h12V20h9v15h10V24h9v12h19v4h19v-5h3v10h24l-13 13H27Z"/><path d="M41 39h27v-3H41Zm106 2h36v-3h-36ZM8 62h204" stroke="currentColor" stroke-width="1.5"/>${index > 1 ? '<path d="M52 34h22v-6H52Zm105 3h30v-6h-30ZM39 27h28v2H39Zm133 2h29v2h-29Z"/>' : ''}</svg>`;
const root = document.querySelector('#app');
let world;
try { world = new World(document.querySelector('#scene')); } catch (error) {
  root.innerHTML = `<div class="webgl-error"><h1>IRON TIDE</h1><p>This game needs WebGL. Enable hardware acceleration in your browser and reload.</p><pre></pre></div>`;
  root.querySelector('pre').textContent = error.message;
  throw error;
}
let profile = readProfile(), selected = profile.selected, difficulty = 'standard', battle = null, paused = false, modal = null;
const audio = new NavalAudio();
let last = performance.now(), uiTime = 0, lastHit = 0, reward = 0, rightDrag = false, dragX = 0, dragY = 0;
const keys = new Set();
let sessionLog = [], notificationTimer, pointerPosition = null;
const save = () => { try { localStorage.setItem('iron-tide-profile-v1', JSON.stringify(profile)); } catch { toast('Progress cannot be saved in this browser session.'); } };
function toast(text) {
  document.querySelector('#toast')?.remove();
  const el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); el.innerHTML = `${icon('info')}<span></span>`; el.querySelector('span').textContent = text; document.body.appendChild(el);
  clearTimeout(notificationTimer); notificationTimer = setTimeout(() => el.remove(), 3600);
}
function playSound(type, position) { audio.play(type, position, battle?.player); }
function soundButton(className = 'icon-button') {
  return `<button class="${className} sound-toggle" data-action="sound" aria-label="${audio.enabled ? 'Mute' : 'Enable'} sound" aria-pressed="${audio.enabled}">${icon(audio.enabled ? 'volume' : 'mute')}${className === 'secondary-button' ? '<span data-sound-label>' + (audio.enabled ? 'Mute sound' : 'Enable sound') + '</span>' : ''}</button>`;
}
function refreshAudioButtons() {
  for (const button of document.querySelectorAll('[data-action="sound"]')) {
    button.setAttribute('aria-label', `${audio.enabled ? 'Mute' : 'Enable'} sound`);
    button.setAttribute('aria-pressed', String(audio.enabled));
    button.querySelector('svg').outerHTML = icon(audio.enabled ? 'volume' : 'mute');
    const label = button.querySelector('[data-sound-label]');
    if (label) label.textContent = audio.enabled ? 'Mute sound' : 'Enable sound';
  }
}
function header() {
  return `<header class="topbar"><a class="brand" href="#" data-action="harbor" aria-label="Iron Tide harbor"><span class="brand-symbol">${icon('anchor')}</span><span>IRON TIDE<small>NAVAL COMMAND</small></span></a><nav aria-label="Main navigation"><button class="nav-link active" data-action="harbor">HARBOR</button><button class="nav-link" data-action="fleet">FLEET <span>04</span></button><button class="nav-link" data-action="research">RESEARCH</button></nav><div class="topbar-right"><span class="credits">${icon('bolt')} <b>${profile.credits.toLocaleString()}</b><small>CR</small></span><span class="divider"></span>${soundButton()}<button class="captain" data-action="profile"><span>R</span><span>ROOKIE<small>FLEET COMMANDER</small></span></button></div></header>`;
}
function harbor() {
  const s = SHIPS.find(s => s.id === selected), idx = SHIPS.indexOf(s);
  root.className = 'harbor-ui';
  root.innerHTML = `${header()}<main class="harbor-main"><div class="location"><span class="live-dot"></span> NORTH ATLANTIC <span class="location-line"></span> 06:40 LOCAL <span class="weather">${icon('waves')} SEA STATE 2</span></div><section class="ship-info"><div class="eyebrow"><span class="tiny-flag">✦</span> THE AURELIAN FLEET <span class="rank-tag">RANK ${s.rank}</span></div><p class="ship-prefix">${s.prefix} / ${s.year}</p><h1>${s.name}<span>.</span></h1><p class="ship-role">${s.role}</p><p class="ship-description">${s.description}</p><div class="ship-stats">${[['shield', 'SURVIVABILITY', s.hull.toLocaleString(), 'HP', s.hull / 4300], ['bolt', 'MAX SPEED', s.speed, 'KNOTS', s.speed / 40], ['target', 'MAIN BATTERY', s.guns + ' × ' + s.caliber, '', s.damage / 750]].map(([i, label, val, unit, pct]) => `<div class="stat"><div>${icon(i)}<span>${label}</span><b>${val} <small>${unit}</small></b></div><div class="stat-track"><i style="width:${pct * 100}%"></i></div></div>`).join('')}</div><button class="text-button" data-action="details">VESSEL SPECIFICATIONS ${icon('arrow')}</button></section><div class="ship-view-label"><span class="view-cross">+</span><span>${s.prefix} ${s.name.toUpperCase()}<small>${s.role.toUpperCase()} · ${s.guns} GUNS · ${s.torpedoes} TORPEDOES</small></span><span class="view-line"></span></div><aside class="operation-card"><div class="operation-top"><span class="eyebrow">YOUR NEXT DEPLOYMENT</span><span class="pulse-dot"></span></div><div class="mission-map"><div class="map-grid"></div><svg viewBox="0 0 300 160" aria-hidden="true"><path d="m0 15 65-15 16 35-23 24 17 23-31 28L0 102Zm300-5-67 9-19 26 19 25-13 20 33 16 47-15ZM300 160l-68-7-18-24 29-14 57 13ZM0 160l69-7 13-22-21-13L0 123Z" fill="#30474b"/><circle cx="150" cy="77" r="30" fill="none" stroke="#c5a56b" stroke-dasharray="3 5"/><path d="m150 64 12 13-12 13-12-13Z" fill="none" stroke="#e2bd7d"/><text x="150" y="81" text-anchor="middle" fill="#e2bd7d" font-size="11" font-family="monospace">A</text><path d="m95 126 4-10 4 10Zm49 5 4-10 4 10Z" fill="#76bcb8"/><path d="m185 25 4 10 4-10Zm-52 2 4 10 4-10Z" fill="#c97e73"/></svg><span class="map-coordinate">57°42′ N · 12°18′ W</span><span class="map-tag">01 / 01</span></div><div class="operation-body"><div class="eyebrow gold">DOMINATION <span>5 MIN</span></div><h2>Operation<br>Breakwater</h2><p>Hostile ships are closing in. Secure the channel. Leave nothing afloat.</p><div class="mission-facts"><span>${icon('compass')} Shattered Isles</span><span>${icon('ship')} Solo + AI fleet</span></div><label class="difficulty-label" for="difficulty">COMBAT DIFFICULTY</label><select id="difficulty"><option value="cadet" ${difficulty === 'cadet' ? 'selected' : ''}>Cadet · forgiving waters</option><option value="standard" ${difficulty === 'standard' ? 'selected' : ''}>Standard · balanced combat</option><option value="veteran" ${difficulty === 'veteran' ? 'selected' : ''}>Veteran · hostile seas</option></select><button class="deploy-button" data-action="deploy">${icon('target')} <span>TO BATTLE</span> ${icon('arrow')}</button><small class="deploy-note">NO MATCHMAKING. STRAIGHT INTO ACTION.</small></div></aside><section class="fleet-strip" aria-label="Select your vessel"><div class="fleet-strip-title"><span>YOUR FLEET <b>0${profile.unlocked.length}<small> / 04</small></b></span><button class="text-button" data-action="research">EXPLORE THE TECH TREE ${icon('arrow')}</button></div><div class="ship-cards">${SHIPS.map((ship, i) => { const unlocked = profile.unlocked.includes(ship.id); return `<button class="ship-card ${selected === ship.id ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-action="select" data-id="${ship.id}" aria-label="${unlocked ? 'Select' : 'Research'} ${ship.name}"><div class="card-top"><span>${unlocked ? 'RANK ' + ship.rank : icon('lock') + ' RANK ' + ship.rank}</span>${selected === ship.id ? '<span class="in-service">IN SERVICE</span>' : unlocked ? '<span>AVAILABLE</span>' : `<span>${ship.cost.toLocaleString()} CR</span>`}</div>${silhouette(i)}<div class="card-bottom"><strong>${ship.name}</strong><span>${ship.role}</span>${selected === ship.id ? icon('check') : icon(unlocked ? 'chevron' : 'lock')}</div></button>`; }).join('')}</div></section></main><footer class="harbor-footer"><span><i class="live-dot"></i> ALL SYSTEMS OPERATIONAL <span class="footer-dot">·</span> ORIGINAL NAVAL COMBAT</span><button data-action="audio">${icon('volume')} AUDIO</button><button data-action="help">${icon('info')} HOW TO PLAY <kbd>?</kbd></button><span class="version">BUILD 1.0 <span class="footer-dot">/</span> OPEN WATERS AWAIT</span></footer>`;
  document.querySelector('#difficulty').addEventListener('change', e => difficulty = e.target.value);
}
function openModal(type) {
  if (battle && !battle.result) { paused = true; clearInputs(); }
  modal = type;
  document.querySelector('.modal-layer')?.remove();
  const s = SHIPS.find(s => s.id === selected);
  let content = '', title = '', eyebrow = '';
  if (type === 'help') {
    title = 'Take command.'; eyebrow = 'FIELD MANUAL / 01';
    content = `<p class="modal-intro">Sink the hostile fleet or hold objective A until your control reaches 100%. Keep your own ship afloat. You have five minutes.</p><div class="control-grid">${[['W / S', 'Increase / decrease engine throttle'], ['A / D', 'Port / starboard rudder'], ['MOUSE', 'Aim main battery at the water'], ['CLICK / SPACE', 'Fire a main battery salvo'], ['Q', 'Launch a torpedo toward your aim'], ['R', 'Repair hull · 2 charges per sortie'], ['RIGHT DRAG', 'Orbit your camera'], ['SCROLL', 'Adjust camera distance'], ['ESC', 'Pause / return to battle']].map(([key, desc]) => `<div><kbd>${key}</kbd><span>${desc}</span></div>`).join('')}</div><div class="tip">${icon('compass')}<p><b>Lead your target.</b> Shells take time to travel. Aim slightly ahead of a moving ship. Torpedoes deal heavy damage but travel more slowly. Engine throttle stays set when you release W or S.</p></div><button class="deploy-button" data-action="close">UNDERSTOOD ${icon('check')}</button>`;
  } else if (type === 'research' || type === 'fleet') {
    title = type === 'fleet' ? 'A fleet of your own.' : 'From hunter to leviathan.'; eyebrow = 'AURELIAN NAVAL BRANCH / RESEARCH';
    content = `<p class="modal-intro">Earn credits in battle. Unlock each vessel in order to advance the Aurelian surface fleet. Your fleet and credits are saved on this browser.</p><div class="research-balance">${icon('bolt')} ${profile.credits.toLocaleString()} <small>AVAILABLE CREDITS</small></div><div class="research-tree">${SHIPS.map((ship, i) => { const owned = profile.unlocked.includes(ship.id), previous = i === 0 || profile.unlocked.includes(SHIPS[i - 1].id), can = previous && profile.credits >= ship.cost; return `<article class="research-ship ${owned ? 'owned' : ''}"><span class="rank-tag">RANK ${ship.rank}</span>${silhouette(i)}<h3>${ship.name}</h3><p>${ship.role}</p><div class="research-spec">${ship.hull.toLocaleString()} HP <span>·</span> ${ship.speed} KN</div><button class="${owned ? 'secondary-button' : 'deploy-button'}" data-action="${owned ? 'equip' : 'unlock'}" data-id="${ship.id}" ${!owned && !can ? 'disabled' : ''}>${owned ? icon(selected === ship.id ? 'check' : 'ship') + (selected === ship.id ? ' EQUIPPED' : ' EQUIP') : icon('lock') + ' ' + ship.cost.toLocaleString() + ' CR'}</button><small>${owned ? 'RESEARCH COMPLETE' : !previous ? 'REQUIRES ' + SHIPS[i - 1].name.toUpperCase() : can ? 'READY TO RESEARCH' : (ship.cost - profile.credits).toLocaleString() + ' MORE CR NEEDED'}</small></article>`; }).join('')}</div>`;
  } else if (type === 'details') {
    title = `ITS ${s.name}`; eyebrow = `VESSEL DOSSIER / RANK ${s.rank}`;
    content = `${silhouette(SHIPS.indexOf(s), 'dossier-ship')}<p class="modal-intro">${s.description}</p><div class="dossier-grid">${[['CLASS', s.role], ['COMMISSIONED', s.year], ['HULL INTEGRITY', s.hull + ' HP'], ['TOP SPEED', s.speed + ' knots'], ['MAIN BATTERY', s.guns + ' × ' + s.caliber], ['SALVO RELOAD', s.reload + ' seconds'], ['TORPEDOES', s.torpedoes || 'None'], ['REPAIR PARTIES', '2 × 36% hull']].map(([a, b]) => `<div><small>${a}</small><b>${b}</b></div>`).join('')}</div>`;
  } else if (type === 'audio') {
    title = 'Sound of the sea.'; eyebrow = 'AUDIO / MASTER MIX';
    content = `<p class="modal-intro">Hear the surf, the engines beneath your feet, and the fleet across the water.</p><div class="audio-settings"><div class="audio-settings-heading">${icon('waves')}<span>OCEAN & COMBAT AUDIO</span>${soundButton('secondary-button')}</div><label class="volume-label" for="master-volume">MASTER VOLUME <output id="volume-value">${Math.round(audio.volume * 100)}%</output></label><input id="master-volume" aria-label="Master volume" type="range" min="0" max="100" step="1" value="${Math.round(audio.volume * 100)}"><div class="audio-layers"><span>OCEAN & WIND</span><span>ENGINE & PROPELLER</span><span>CANNONS & TORPEDOES</span><span>IMPACTS & REPAIRS</span></div></div><p class="audio-note">Sound starts after your first interaction. Your volume and mute settings are remembered on this browser.</p>`;
  } else if (type === 'profile') {
    title = 'Your service record.'; eyebrow = 'FLEET COMMANDER / ROOKIE';
    content = `<p class="modal-intro">Every sortie leaves a mark. Your record is stored locally in this browser.</p><div class="record-grid">${[['SORTIES', profile.battles], ['VICTORIES', profile.victories], ['BEST KILLS', profile.bestKills], ['VESSELS', profile.unlocked.length + ' / 4']].map(([a, b]) => `<div><strong>${b}</strong><small>${a}</small></div>`).join('')}</div>`;
  } else if (type === 'pause') {
    title = 'Holding position.'; eyebrow = 'BATTLE PAUSED';
    content = `<p class="modal-intro">Your fleet is standing by. Resume the operation when you’re ready.</p><div class="pause-actions"><button class="deploy-button" data-action="close">RESUME BATTLE ${icon('arrow')}</button><button class="secondary-button" data-action="help">CONTROLS & FIELD MANUAL ${icon('info')}</button><button class="secondary-button" data-action="audio">AUDIO SETTINGS ${icon('volume')}</button><button class="secondary-button danger" data-action="abandon">ABANDON SORTIE</button></div>`;
  }
  const layer = document.createElement('div'); layer.className = `modal-layer ${type === 'research' || type === 'fleet' ? 'wide' : ''}`;
  layer.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close icon-button" data-action="close" aria-label="Close dialog">${icon('close')}</button><div class="eyebrow gold">${eyebrow}</div><h2 id="modal-title">${title}</h2>${content}</section>`;
  root.appendChild(layer); layer.querySelector('button:not([disabled])')?.focus();
  layer.querySelector('#master-volume')?.addEventListener('input', e => {
    audio.setVolume(Number(e.target.value) / 100);
    document.querySelector('#volume-value').textContent = `${e.target.value}%`;
  });
}
function closeModal() {
  document.querySelector('.modal-layer')?.remove(); modal = null; paused = false; keys.clear();
  last = performance.now();
}
function clearInputs() { pointerPosition = null; keys.clear(); rightDrag = false; if (battle) battle.input = { throttle: 0, steer: 0, fire: false }; }
function selectShip(id) {
  if (!profile.unlocked.includes(id)) { openModal('research'); return; }
  selected = id; profile.selected = id; save(); world.selectShip(id); harbor();
}
function startBattle() {
  closeModal(); clearInputs(); battle = new Battle(selected, difficulty); sessionLog = []; reward = 0;
  world.startBattle(battle); paused = false; root.className = 'battle-ui';
  root.innerHTML = `<div class="battle-top"><div class="battle-brand">${icon('anchor')}<span>IRON TIDE<small>OPERATION BREAKWATER</small></span></div><div class="battle-score"><div class="team-score"><span>AURELIAN FLEET</span><div><i id="friendly-score"></i></div></div><div class="objective-icon">A</div><div class="team-score enemy"><span>HOSTILE FLEET</span><div><i id="enemy-score"></i></div></div><div id="battle-timer">05:00</div></div><div class="battle-toolbar">${soundButton()}<button class="icon-button pause-button" data-action="pause" aria-label="Pause battle">${icon('pause')}<kbd>ESC</kbd></button></div></div><div class="battle-objective"><span class="live-dot"></span><span id="objective-text">CAPTURE A OR ELIMINATE THE HOSTILE FLEET</span></div><div class="compass"><span>SW</span><i></i><span>W</span><i></i><span>NW</span><b id="heading">180°</b><span>N</span><i></i><span>NE</span><i></i><span>E</span></div><div id="ship-labels"></div><div id="hit-indicator"></div><div id="battle-feed"></div><div class="aim-readout"><span id="aim-distance">— M</span><span>MAIN BATTERY</span></div><div class="battle-bottom"><section class="vessel-hud"><div class="vessel-hud-title">${icon('ship')}<span>ITS ${SHIPS.find(s => s.id === selected).name.toUpperCase()}<small id="hull-number"></small></span><b id="speed-number">0<small>KNOTS</small></b></div><div class="hull-track"><i id="hull-bar"></i></div><div class="throttle-display"><span>ENGINE <b id="throttle-label">STOP</b></span><span id="repair-label">HULL INTEGRITY</span></div><div class="throttle-track"><i id="throttle-bar"></i></div><div class="helm-hint"><kbd>W</kbd><kbd>S</kbd> ENGINE <span></span><kbd>A</kbd><kbd>D</kbd> RUDDER</div></section><section class="weapons-hud"><button class="weapon selected" data-action="fire" aria-label="Fire main battery"><kbd>SPACE / LMB</kbd>${icon('gun')}<b>MAIN BATTERY</b><span id="gun-status">READY</span><i id="gun-reload"></i></button><button class="weapon" data-action="torpedo" aria-label="Launch torpedo"><kbd>Q</kbd>${icon('target')}<b>TORPEDO</b><span id="torpedo-status">READY</span><i id="torpedo-reload"></i></button><button class="weapon" data-action="repair" aria-label="Repair ship"><kbd>R</kbd>${icon('wrench')}<b>REPAIR PARTY</b><span id="repair-status">2 CHARGES</span><i id="repair-reload"></i></button></section><section class="minimap-wrap"><div><span>SHATTERED ISLES</span><span id="battle-kills">0 SUNK</span></div><canvas id="minimap" width="220" height="190" aria-label="Tactical map showing ships, islands and objective A"></canvas><span class="minimap-scale">N ↑ <span>2 KM</span></span></section></div><div class="battle-tip" id="battle-tip"><kbd>W</kbd> GET UNDERWAY <span>·</span> MOUSE TO AIM <span>·</span> CLICK TO FIRE</div><div class="damage-vignette"></div>`;
  toast('Operation underway. Capture A or sink every hostile ship.');
  const helm = document.createElement('div'); helm.className = 'touch-helm';
  helm.innerHTML = '<button data-key="KeyW" aria-label="Increase throttle">W ↑</button><button data-key="KeyA" aria-label="Turn port">← A</button><button data-key="KeyS" aria-label="Decrease throttle">S ↓</button><button data-key="KeyD" aria-label="Turn starboard">D →</button>';
  root.appendChild(helm);
  for (const control of helm.querySelectorAll('button')) {
    control.addEventListener('pointerdown', e => { e.preventDefault(); if (paused || battle.result) return; control.setPointerCapture(e.pointerId); keys.add(control.dataset.key); });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) control.addEventListener(event, () => keys.delete(control.dataset.key));
  }
  audio.update(battle); playSound('horn');
  last = performance.now(); updateHUD();
}
function processEvents() {
  for (const event of battle.events.splice(0)) {
    if (event.type === 'fire') {
      world.effect(event.ship.x, event.ship.z, 'fire');
      playSound(event.torpedo ? 'torpedo' : 'fire', event.ship);
    }
    if (event.type === 'splash') { world.effect(event.x, event.z, event.large ? 'explosion' : 'splash'); playSound('splash', event); }
    if (event.type === 'hit') {
      if (event.playerHit) { lastHit = performance.now(); document.querySelector('#hit-indicator').innerHTML = `${icon('target')}<b>HIT <span>+${event.damage}</span></b>`; playSound('hit', event.ship); }
      if (event.ship.role === 'player') { document.querySelector('.damage-vignette').classList.remove('flash'); void document.querySelector('.damage-vignette').offsetWidth; document.querySelector('.damage-vignette').classList.add('flash'); playSound('hit', event.ship); }
    }
    if (event.type === 'sunk') {
      world.effect(event.ship.x, event.ship.z, 'explosion'); playSound('sunk', event.ship);
      sessionLog.unshift({ text: `${event.ship.name} ${event.ship.team === 1 ? 'destroyed' : 'lost'}`, enemy: event.ship.team === 1 });
      document.querySelector('#battle-feed').innerHTML = sessionLog.slice(0, 4).map(e => `<div class="${e.enemy ? 'enemy-sunk' : ''}">${icon('target')} ${e.text}</div>`).join('');
    }
    if (event.type === 'collision') { playSound('collision'); toast('Shallow water. Reverse engines and steer clear of the island.'); }
    if (event.type === 'repair') { playSound('repair'); toast('Repair party deployed. Restoring hull over 8 seconds.'); }
    if (event.type === 'end') endBattle(event.result);
  }
}
function endBattle(result) {
  playSound(result);
  clearInputs(); reward = rewardFor(result, battle.kills, battle.damage, battle.capSeconds);
  profile.credits += reward; profile.battles++; if (result === 'victory') profile.victories++; profile.bestKills = Math.max(profile.bestKills, battle.kills); save();
  const layer = document.createElement('div'); layer.className = 'modal-layer result-layer';
  layer.innerHTML = `<section class="modal result-modal" role="dialog" aria-modal="true" aria-labelledby="result-title"><div class="result-emblem">${icon(result === 'victory' ? 'trophy' : 'anchor')}</div><div class="eyebrow gold">OPERATION BREAKWATER / AFTER ACTION REPORT</div><h2 id="result-title">${result === 'victory' ? 'The sea is yours.' : 'A hard-fought battle.'}</h2><p class="modal-intro">${result === 'victory' ? 'The channel is secure. The fleet salutes you, Commander.' : battle.player.dead ? 'Your vessel has been lost. Regroup, research, and return stronger.' : 'The operation is over. Regroup and return to the fight.'}</p><div class="result-stats"><div><strong>${battle.kills}</strong><small>SHIPS SUNK</small></div><div><strong>${Math.round(battle.damage).toLocaleString()}</strong><small>DAMAGE DEALT</small></div><div><strong>${Math.floor(battle.elapsed / 60)}:${String(Math.floor(battle.elapsed % 60)).padStart(2, '0')}</strong><small>TIME AT SEA</small></div></div><div class="result-reward">${icon('bolt')}<strong>+${reward.toLocaleString()}</strong><span>CREDITS EARNED</span></div><div class="result-actions"><button class="secondary-button" data-action="return">RETURN TO HARBOR</button><button class="deploy-button" data-action="deploy">SAIL AGAIN ${icon('arrow')}</button></div></section>`;
  root.appendChild(layer); modal = 'result';
}
function returnToHarbor() { clearInputs(); battle = null; paused = false; modal = null; world.harbor(); harbor(); }
function drawMap() {
  const canvas = document.querySelector('#minimap'); if (!canvas) return;
  const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#10282f'; ctx.fillRect(0, 0, w, h);
  const scale = .045, cx = w / 2, cy = h / 2;
  ctx.strokeStyle = '#274047'; ctx.lineWidth = .5;
  for (let x = 0; x < w; x += 22) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 19) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.fillStyle = '#536356';
  for (const i of ISLANDS) { ctx.beginPath(); ctx.ellipse(cx + i.x * scale, cy + i.z * scale, i.r * scale, i.r * scale * .85, .4, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = battle.contested ? '#ee8874' : '#dcba7d'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, 245 * scale, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#dcba7d'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillText('A', cx, cy + 3);
  for (const s of battle.ships) {
    if (s.dead) continue;
    ctx.save(); ctx.translate(cx + s.x * scale, cy + s.z * scale); ctx.rotate(-s.heading + Math.PI);
    ctx.fillStyle = s.role === 'player' ? '#faf0d6' : s.team === 0 ? '#77c7ba' : '#e38c7e';
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-3.5, 4); ctx.lineTo(3.5, 4); ctx.closePath(); ctx.fill(); ctx.restore();
  }
}
function updateHUD() {
  if (!battle || !document.querySelector('#hull-bar')) return;
  const p = battle.player, pct = p.hull / p.stats.hull;
  document.querySelector('#hull-bar').style.width = `${pct * 100}%`;
  document.querySelector('#hull-bar').style.background = pct < .3 ? '#da7a68' : '#86bcb0';
  document.querySelector('#hull-number').textContent = `${Math.ceil(p.hull).toLocaleString()} / ${p.stats.hull.toLocaleString()} HP`;
  document.querySelector('#speed-number').innerHTML = `${Math.round(Math.abs(p.speed) / 1.4)}<small>KNOTS</small>`;
  document.querySelector('#throttle-label').textContent = p.throttle < -.05 ? 'ASTERN' : p.throttle < .05 ? 'STOP' : p.throttle > .95 ? 'FULL AHEAD' : Math.round(p.throttle * 100) + '% AHEAD';
  document.querySelector('#throttle-bar').style.width = `${Math.abs(p.throttle) * 100}%`;
  document.querySelector('#repair-label').textContent = p.repairTime > 0 ? `REPAIRING ${p.repairTime.toFixed(1)}s` : 'HULL INTEGRITY';
  document.querySelector('#gun-status').textContent = p.reload > 0 ? p.reload.toFixed(1) + 's RELOADING' : 'READY';
  document.querySelector('#gun-reload').style.width = `${(1 - p.reload / p.stats.reload) * 100}%`;
  document.querySelector('#torpedo-status').textContent = p.torpedoes <= 0 ? 'DEPLETED' : p.torpedoReload > 0 ? p.torpedoReload.toFixed(1) + 's' : p.torpedoes + ' AVAILABLE';
  document.querySelector('#torpedo-reload').style.width = `${p.torpedoes ? (1 - p.torpedoReload / 14) * 100 : 0}%`;
  document.querySelector('#repair-status').textContent = p.repairTime > 0 ? p.repairTime.toFixed(1) + 's ACTIVE' : p.repairs + ' CHARGES';
  document.querySelector('#repair-reload').style.width = `${p.repairTime ? (1 - p.repairTime / 8) * 100 : p.repairs ? 100 : 0}%`;
  document.querySelector('#battle-kills').textContent = `${battle.kills} SUNK`;
  document.querySelector('#friendly-score').style.width = `${battle.capture}%`;
  document.querySelector('#enemy-score').style.width = `${battle.enemyCapture}%`;
  const t = Math.max(0, battle.duration - battle.elapsed);
  document.querySelector('#battle-timer').textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const atCap = Math.hypot(p.x, p.z) < 245;
  document.querySelector('#objective-text').textContent = battle.contested ? 'OBJECTIVE CONTESTED — ELIMINATE NEARBY HOSTILES' : atCap ? `CAPTURING OBJECTIVE A · ${Math.floor(battle.capture)}%` : `CAPTURE A · ${Math.floor(battle.capture)}% CONTROL · OR ELIMINATE THE HOSTILE FLEET`;
  const bearing = (180 - p.heading * 180 / Math.PI + 3600) % 360;
  document.querySelector('#heading').textContent = `${Math.round(bearing) % 360}°`;
  document.querySelectorAll('.compass > span').forEach((label, i) => {
    const offset = [-135, -90, -45, 45, 90, 135][i];
    label.textContent = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((bearing + offset + 360) % 360 / 45) % 8];
  });
  document.querySelector('#aim-distance').textContent = `${Math.round(distance(p, battle.aim)).toLocaleString()} M`;
  document.querySelector('#battle-tip').style.opacity = battle.time > 14 ? '0' : '1';
  if (performance.now() - lastHit > 1100) document.querySelector('#hit-indicator').innerHTML = '';
  const labels = [];
  for (const s of battle.ships) {
    if (s.role === 'player' || s.dead) continue;
    const pt = world.project(s.x, 45, s.z);
    if (pt.visible) labels.push(`<div class="ship-label ${s.team === 0 ? 'friendly' : ''}" style="left:${pt.x}px;top:${pt.y}px"><span>${s.team === 0 ? '◆' : '◇'} ${s.name}</span><small>${Math.round(distance(p, s))} M · ${s.stats.role.toUpperCase()}</small><div><i style="width:${s.hull / s.stats.hull * 100}%"></i></div></div>`);
  }
  const cap = world.project(0, 38, 0);
  if (cap.visible) labels.push(`<div class="cap-label" style="left:${cap.x}px;top:${cap.y}px"><b>A</b><small>${Math.round(Math.hypot(p.x, p.z))} M</small></div>`);
  document.querySelector('#ship-labels').innerHTML = labels.join(''); drawMap();
}
root.addEventListener('click', async e => {
  const button = e.target.closest('[data-action]'); if (!button || button.disabled) return;
  e.preventDefault(); const action = button.dataset.action, id = button.dataset.id;
  await audio.unlock();
  if (action === 'sound') { audio.setEnabled(!audio.enabled); refreshAudioButtons(); }
  else if (action === 'harbor') { if (!battle) { closeModal(); harbor(); } }
  else if (['help', 'fleet', 'research', 'details', 'profile', 'pause', 'audio'].includes(action)) openModal(action);
  else if (action === 'close') closeModal();
  else if (action === 'select' || action === 'equip') selectShip(id);
  else if (action === 'unlock') { if (unlockShip(profile, id)) { save(); toast(`${SHIPS.find(s => s.id === id).name} has joined your fleet.`); openModal('research'); } }
  else if (action === 'deploy') startBattle();
  else if (action === 'return') returnToHarbor();
  else if (action === 'abandon') { closeModal(); battle.finish('defeat'); processEvents(); }
  else if (action === 'fire' && battle && !paused) battle.fire(battle.player, battle.aim);
  else if (action === 'torpedo' && battle && !paused) { if (!battle.fire(battle.player, battle.aim, true)) toast(battle.player.torpedoes ? 'Torpedo tubes are reloading.' : 'No torpedoes remaining.'); }
  else if (action === 'repair' && battle && !paused) { if (!battle.repair()) toast(battle.player.hull >= battle.player.stats.hull ? 'Hull is already at full integrity.' : 'Repair party unavailable.'); }
});
window.addEventListener('keydown', e => {
  if (e.code === 'Escape') { if (modal === 'result') return; if (modal) closeModal(); else if (battle) openModal('pause'); return; }
  if (e.key === '?' && !battle) openModal('help');
  if (battle && !paused && !battle.result) {
    if (['Space', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyR'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    if (!e.repeat && e.code === 'KeyQ') { if (!battle.fire(battle.player, battle.aim, true)) toast(battle.player.torpedoes ? 'Torpedo tubes are reloading.' : 'No torpedoes remaining.'); }
    if (!e.repeat && e.code === 'KeyR') { if (!battle.repair()) toast(battle.player.hull >= battle.player.stats.hull ? 'Hull is already at full integrity.' : 'Repair party unavailable.'); }
  }
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => { clearInputs(); if (battle && !battle.result && !paused) openModal('pause'); });
document.addEventListener('visibilitychange', () => { audio.setHidden(document.hidden); if (document.hidden && battle && !battle.result && !paused) openModal('pause'); });
window.addEventListener('pointermove', e => {
  if (!battle || paused || battle.result) return;
  if (rightDrag) { world.orbit -= (e.clientX - dragX) * .005; world.elevation = clamp(world.elevation + (e.clientY - dragY) * .003, .1, 1.25); dragX = e.clientX; dragY = e.clientY; }
  else if (!e.target.closest('button')) { pointerPosition = { x: e.clientX, y: e.clientY }; world.aimAt(e.clientX, e.clientY, battle); }
});
window.addEventListener('pointerdown', e => {
  if (!battle || paused || battle.result || e.target.closest('button, .modal')) return;
  if (e.button === 2) { rightDrag = true; dragX = e.clientX; dragY = e.clientY; }
  if (e.button === 0) { pointerPosition = { x: e.clientX, y: e.clientY }; world.aimAt(e.clientX, e.clientY, battle); battle.input.fire = true; }
});
window.addEventListener('pointerup', e => { if (e.button === 2) rightDrag = false; if (e.button === 0 && battle) battle.input.fire = false; });
window.addEventListener('contextmenu', e => { if (battle) e.preventDefault(); });
window.addEventListener('wheel', e => { if (battle && !paused && !modal && !e.target.closest('.modal')) world.zoom = clamp(world.zoom + e.deltaY * .001, .5, 2.5); }, { passive: true });
// Keep keyboard navigation within the active dialog.
window.addEventListener('keydown', e => {
  if (e.code !== 'Tab' || !modal) return;
  const dialog = document.querySelector('.modal-layer:last-child'), buttons = [...dialog?.querySelectorAll('button:not([disabled]), input:not([disabled]), select, a[href]') || []];
  if (!buttons.length) return;
  const first = buttons[0], lastButton = buttons.at(-1);
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastButton.focus(); }
  else if (!e.shiftKey && document.activeElement === lastButton) { e.preventDefault(); first.focus(); }
});
world.selectShip(selected); harbor();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.25, Math.max(0, (now - last) / 1000)); last = now;
  if (battle && !paused && !battle.result) {
    battle.input.throttle = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    battle.input.steer = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
    const mouseFire = battle.input.fire;
    if (keys.has('Space')) battle.input.fire = true;
    for (let remaining = dt; remaining > 0; remaining -= .05) battle.step(Math.min(.05, remaining));
    battle.input.fire = mouseFire; processEvents();
  }
  world.update(dt, battle, paused);
  if (pointerPosition && battle && !paused && !rightDrag && !battle.result) world.aimAt(pointerPosition.x, pointerPosition.y, battle);
  uiTime += dt; if (uiTime > .075) { if (battle) updateHUD(); audio.update(battle, paused); uiTime = 0; }
}
requestAnimationFrame(frame);
// Development diagnostics used by the browser smoke checks.
window.ironTide = { get battle() { return battle; }, get profile() { return structuredClone(profile); }, get paused() { return paused; }, get world() { return world; }, get audio() { return audio; } };
