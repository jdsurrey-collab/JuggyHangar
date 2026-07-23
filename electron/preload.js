// Nothing to expose yet — the renderer is the same plain web app that runs
// in a browser and doesn't need any Node/Electron APIs. Kept as an empty
// preload (rather than skipping it) so contextIsolation + sandbox stay on
// by default if a future feature needs to bridge something in via
// contextBridge.exposeInMainWorld.
