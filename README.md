# IRON TIDE — Naval Command

An original, playable single-player 3D naval combat game. Command an Aurelian warship in the Shattered Isles, fight an AI fleet, and earn credits to research heavier ships.

## Run

Requires Node.js 22.12+ (Node.js 24 recommended), npm, and a browser with WebGL 2.

```sh
npm ci --cache /tmp/iron-tide-npm
npm run dev -- --port 5173
```

Open the dev server in your browser, select a difficulty, then choose **TO BATTLE**. No account, API keys, backend, or downloaded art assets are needed. Fonts are bundled with the application. Sound is optional; enable it using the speaker button in the harbor.

```sh
npm run build       # Build the standalone site in dist/
npm run preview     # Serve the production build
npm test            # 16 combat, AI, objective and progression tests
npm run test:browser # Chromium gameplay and responsive UI checks
```

For browser checks, use an installed Chromium at `/usr/bin/chromium`, set `CHROMIUM_PATH`, or install Playwright's Chromium with `npx playwright install chromium`. `test:browser` starts its own server on port 4173; set `TEST_BASE_URL` to test an existing server. Screenshots go to the ignored `artifacts/` directory.

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

## The Aurelian naval branch

Research each vessel in sequence. Earn credits for sorties, victories, ships sunk, damage, and time spent capturing the objective.

| Rank | Ship | Class | Main battery | Hull | Speed | Unlock |
| --- | --- | --- | --- | --- | --- | --- |
| I | ITS Kestrel | Coastal destroyer | 4 × 120 mm | 1,200 HP | 34 knots | Starter |
| II | ITS Vanguard | Fleet destroyer | 6 × 127 mm | 1,700 HP | 38 knots | 600 CR |
| III | ITS Resolute | Light cruiser | 8 × 152 mm | 2,700 HP | 29 knots | 1,500 CR |
| IV | ITS Monarch | Battleship | 9 × 305 mm | 4,300 HP | 23 knots | 3,000 CR |

Credits, researched vessels, your equipped ship, and the service record persist in this browser's `localStorage`. Clearing site data resets progress. Abandoning a sortie records a defeat. Ongoing battles are not saved between page reloads.

## Project structure

- `src/simulation.js` — rendering-independent movement, AI, ballistics, torpedoes, repairs, damage, and objectives.
- `src/world.js` — Three.js ocean shader, sky, procedural islands and ship models, follow camera, and combat effects.
- `src/data.js` — ship definitions, progression, rewards, and profile storage.
- `src/app.js` — harbor, controls, combat HUD, tech tree, audio, and after-action reports.
- `src/style.css` — responsive harbor and battle interfaces.
- `tests/` — simulation and browser integration checks.

The artwork, fictional fleet, ocean shader, and game interface are original. This is an arcade naval combat prototype inspired by the genre, with single-player AI battles; it does not include multiplayer or a detailed armor-penetration simulation.

## Play from a public web address

This cloud workspace is separate from your own computer. A `/workspace/` path or the cloud server's localhost address is not a public game link.

To publish the game using this repository's GitHub Pages hosting:

1. In the GitHub repository, open **Settings → Pages** and select **GitHub Actions** as the build source.
2. Open **Actions → Publish IRON TIDE → Run workflow**. Select the `feat/iron-tide-naval-combat` branch and run it.
3. When the workflow succeeds, open the website URL shown in its deployment result.

The workflow installs locked dependencies, runs the combat tests, builds assets under the repository's Pages path, and publishes `dist/`. Publication requires the repository's Pages settings to allow it. The workflow is manual and does not publish when code is pushed.
