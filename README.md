# Juggy Hangar

A Star Citizen fleet browser, weapon/component loadout optimizer, ship
comparison tool, and commodity trade route calculator. Live data comes
from [api.star-citizen.wiki](https://api.star-citizen.wiki) — no backend
of its own.

## Running it as a web page (no install)

The app itself has no build step — it's plain ES modules loaded straight
in the browser (React/htm via esm.sh). Any static file server works:

```
python3 -m http.server 8420
```

then open `http://localhost:8420`.

## Running it as a desktop app (Electron)

Requires [Node.js](https://nodejs.org) 18+.

```
npm install
npm start
```

`npm start` launches the Electron app, which spins up a tiny local
static server (127.0.0.1, random port) internally and points a
BrowserWindow at it — same app, same code, just wrapped for desktop.

### Building installers

```
npm run dist:mac    # .dmg, unsigned (Gatekeeper will warn on first launch)
npm run dist:win    # NSIS .exe, unsigned (SmartScreen will warn on first launch)
npm run dist        # both, if run on a machine that can build both
```

Output lands in `release/`. These are **unsigned** builds — there's no
Apple Developer or Windows code-signing certificate configured, so
Gatekeeper/SmartScreen will show an "unidentified developer" prompt on
first launch. That's expected; signing can be added later if this needs
wider distribution.

### CI builds

Pushing a tag like `v1.0.0` triggers
`.github/workflows/build.yml`, which builds the Mac and Windows
installers on GitHub's own runners (this avoids cross-compiling a Windows
.exe from a Mac, which isn't reliable) and attaches them to a draft
GitHub Release.

## Project layout

- `src/` — the app itself (routing, pages, the loadout optimizer/knapsack
  solver, API client with IndexedDB caching, localStorage-backed "My
  Hangar" saves).
- `electron/` — the desktop wrapper: `main.js` (window + lifecycle),
  `static-server.js` (the local file server), `preload.js` (currently
  empty — no Node APIs are exposed to the renderer yet).
- `build/` — app icons (`.icns` for Mac, `.ico` for Windows) generated
  from `icon.svg`.
- `manifest.json` / `sw.js` — this is also an installable PWA in any
  browser that supports it (Chrome/Edge "Install App"), independent of
  the Electron build.
