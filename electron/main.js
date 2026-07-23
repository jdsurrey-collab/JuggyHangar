const path = require("path");
const { app, BrowserWindow, shell } = require("electron");
const { startStaticServer } = require("./static-server.js");

let mainWindow = null;
let serverHandle = null;

async function createWindow() {
  // App root is the parent of this electron/ folder, both in dev and once
  // packaged inside app.asar — Electron's patched fs/path handling makes
  // __dirname resolve correctly in both cases.
  const appRoot = path.join(__dirname, "..");
  if (!serverHandle) {
    serverHandle = await startStaticServer(appRoot);
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#0b0e14",
    icon: path.join(appRoot, "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${serverHandle.port}/index.html#/ships`);

  // Links that would otherwise open in the app window (e.g. RSI store
  // links) open in the user's real browser instead.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("will-quit", () => {
  if (serverHandle) serverHandle.server.close();
});
