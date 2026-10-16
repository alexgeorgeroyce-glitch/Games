# IRON TIDE — Naval Command

An original, playable single-player 3D naval combat game. Command an Aurelian warship in the Shattered Isles, fight an AI fleet, and earn credits to research heavier ships.

## Run

Requires Node.js 22.12+ (Node.js 24 recommended), npm, and a browser with WebGL 2.

```sh
npm ci --cache /tmp/iron-tide-npm
npm run dev -- --port 5173
```

Open the dev server in your browser, select a difficulty, then choose **TO BATTLE**. No account, API keys, backend, or downloaded art assets are needed. Fonts are bundled with the application. Sound starts after your first interaction. The mix includes ocean surf, wind, speed-responsive engine and propeller noise, spatial cannon fire, torpedo launches, shell splashes, impacts, repairs, reloads, and victory/defeat cues. Use the speaker button to mute or unmute; choose **AUDIO** in the harbor or **Audio settings** in the pause menu to set the master volume. Volume and mute preferences persist on this browser.

```sh
npm run build       # Build the standalone site in dist/
npm run preview     # Serve the production build
npm test            # 28 combat, battery-clearance, progression, geometry and audio tests
npm run test:browser # Chromium gameplay and responsive UI checks
```

For browser checks, use an installed Chromium at `/usr/bin/chromium`, set `CHROMIUM_PATH`, or install Playwright's Chromium with `npx playwright install chromium`. `test:browser` starts its own server on a free local port; set `TEST_BASE_URL` to test an existing development server. Screenshots go to the ignored `artifacts/` directory.

## How to play

Win a five-minute sortie by eliminating every hostile ship or holding objective **A** until friendly control reaches 100%. Losing your ship, losing the objective, or finishing without a control advantage results in defeat. One allied AI ship accompanies you. Cadet, Standard, and Veteran difficulties change the enemy lineup and targeting accuracy.

| Control | Action |
| --- | --- |
| W / S | Increase / decrease engine throttle; the engine setting persists after release |
| A / D | Turn to port / starboard |
| Mouse | Aim the main battery at the ocean |
| Left click / Space | Fire; hold to fire again when reloaded |
| Q | Launch a torpedo toward your aim; 14-second tube reload |
| R | Deploy a repair party; 2 charges restore up to 36% hull each over 8 seconds |
| Right drag | Orbit and raise/lower the camera |
| Scroll | Adjust camera distance |
| Esc | Pause / resume |

On touch screens, hold the on-screen W/S/A/D helm buttons, tap the ocean to aim and fire, and use the weapon buttons for torpedoes and repairs. Desktop keyboard and mouse give the most precise aiming.

Shells follow visible ballistic arcs. Lead moving targets. Torpedoes travel at the surface, hit hard, and can be blocked by islands. The minimap shows the objective, shoreline, allies, and hostiles. Hostile ships also fire and maneuver independently. Your hull cannot be damaged by friendly fire.

## The Aurelian naval tree

Twelve vessels span three research branches. Destroyers progress from Kestrel through Vanguard and Tempest to Phantom. The cruiser branch starts with Resolute (requires Kestrel), then advances through Bastion, Sentinel and Valiant. Resolute also opens the capital branch: Monarch → Sovereign → Leviathan → Dreadnought. Research uses each vessel’s named prerequisite, so you can pursue one branch without completing the others.

| Ship | Branch | Battery | Damage / shell | Full broadside | Hull | Unlock | Requires |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Kestrel | destroyers | 4 × 120 mm | 53 | 212 | 1,200 HP | 0 CR | Starter |
| Vanguard | destroyers | 6 × 127 mm | 57 | 342 | 1,700 HP | 600 CR | Kestrel |
| Tempest | destroyers | 8 × 130 mm | 59 | 472 | 2,200 HP | 1,400 CR | Vanguard |
| Phantom | destroyers | 8 × 138 mm | 65 | 520 | 2,900 HP | 2,800 CR | Tempest |
| Resolute | cruisers | 8 × 152 mm | 76 | 608 | 3,000 HP | 1,500 CR | Kestrel |
| Bastion | cruisers | 8 × 180 mm | 98 | 784 | 4,400 HP | 2,800 CR | Resolute |
| Sentinel | cruisers | 12 × 203 mm | 119 | 1,428 | 5,800 HP | 4,200 CR | Bastion |
| Valiant | cruisers | 12 × 254 mm | 168 | 2,016 | 7,600 HP | 6,200 CR | Sentinel |
| Monarch | capital | 9 × 305 mm | 223 | 2,007 | 6,500 HP | 3,000 CR | Resolute |
| Sovereign | capital | 12 × 356 mm | 283 | 3,396 | 8,800 HP | 5,000 CR | Monarch |
| Leviathan | capital | 12 × 406 mm | 347 | 4,164 | 11,200 HP | 7,500 CR | Sovereign |
| Dreadnought | capital | 12 × 460 mm | 421 | 5,052 | 14,500 HP | 10,500 CR | Leviathan |

## Bring your guns to bear

Right-drag to orbit the camera and keep the target in view while turning your ship. Aim abeam—roughly 70°–110° off the bow on either side—to bring both the forward and aft batteries into action. The HUD reports **PORT BROADSIDE**, **STARBOARD BROADSIDE**, **BOW BATTERY**, or **STERN BATTERY**, along with guns in arc and potential damage. Each turret has its own reload. Turning to the other side does not reset a reload, but an unused, loaded turret can join the next salvo.

Each ready barrel spawns its own shell at its muzzle. Larger calibers deal more damage per shell, and full broadside damage equals shell damage multiplied by the total number of guns. Masked turrets cannot fire through the bridge and stow toward their own end of the ship. A shared mount layout controls both the simulation and the model: spaced housings, smaller correctly scaled turrets, and raised inner mounts let barrels fire over the outer mounts without intersecting them.

Credits, researched vessels, your equipped ship, and the service record persist in this browser's `localStorage`. Clearing site data resets progress. Abandoning a sortie records a defeat. Ongoing battles are not saved between page reloads.

## Project structure

- `src/simulation.js` — rendering-independent movement, AI, ballistics, torpedoes, repairs, damage, and objectives.
- `src/world.js` — Three.js ocean shader, sky, detailed island terrain and instanced trees, follow camera, and combat effects.
- `src/ships.js` — curved hulls, rounded turrets, portholes, rails, lifeboats, deck equipment, and animated flags. Models now have approximately 239,000–288,000 triangles each, with denser hull stations, rounded armored turrets, barrel collars, searchlights, hull rivets and anchor chains. Static fittings are combined by material; distant AI ships use lighter silhouettes with identical battery positions, while the player and nearby ships retain the full geometry.
- `src/audio.js` — original Web Audio ambience and effects, distance attenuation and stereo panning, speed-responsive engines, and persistent master volume/mute controls.
- `src/data.js` — twelve ship definitions, three research branches, rewards, and backward-compatible profile storage.
- `src/weapons.js` — shared physical turret layouts, firing arcs, muzzle positions, caliber-based shell damage and independent turret reloads.
- `src/app.js` — harbor, controls, combat HUD, tech tree, audio, and after-action reports.
- `src/style.css` — responsive harbor and battle interfaces.
- `tests/` — simulation, 360° turret/bridge clearance sweeps, port and starboard damage checks, research-branch progression, geometry, audio-preference and browser integration checks. The browser suite also renders 11 effects through OfflineAudioContext to verify non-silent, unclipped waveforms, tests the live analyser for audible/muted output, and checks engine/pause audio behavior.

The artwork, fictional fleet, ocean shader, and game interface are original. This is an arcade naval combat prototype inspired by the genre, with single-player AI battles; it does not include multiplayer or a detailed armor-penetration simulation.

## Play from a public web address

This cloud workspace is separate from your own computer. A `/workspace/` path or the cloud server's localhost address is not a public game link.

To publish the game using this repository's GitHub Pages hosting:

1. In the GitHub repository, open **Settings → Pages** and select **GitHub Actions** as the build source.
2. Open **Actions → Publish IRON TIDE → Run workflow**. Select the `feat/iron-tide-naval-combat` branch and run it.
3. When the workflow succeeds, open the website URL shown in its deployment result.

The workflow installs locked dependencies, runs the combat tests, builds assets under the repository's Pages path, and publishes `dist/`. Publication requires the repository's Pages settings to allow it. The workflow is manual and does not publish when code is pushed.
