// Minimal same-origin static file server for the app's own files. We
// deliberately avoid Electron's file:// loadFile() here: this app uses
// root-absolute paths ("/src/main.js", service worker scope "/") and
// registers a service worker, neither of which work under file://
// (service workers require an http/https origin, and "/..." paths resolve
// against the filesystem root, not the HTML file's folder, under file://).
// A tiny local HTTP server sidesteps both problems with no new
// dependencies — this is the standard pattern for wrapping an existing
// static web app in Electron.
const http = require("http");
const fs = require("fs");
const path = require("path");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function startStaticServer(rootDir, preferredPort) {
  const server = http.createServer((req, res) => {
    const requestPath = decodeURIComponent(req.url.split("?")[0]);
    const relative = requestPath === "/" ? "/index.html" : requestPath;
    const filePath = path.normalize(path.join(rootDir, relative));

    // Refuse to serve anything outside the app's own directory.
    if (!filePath.startsWith(path.normalize(rootDir))) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
      res.end(data);
    });
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    // Port 0 asks the OS for any free port — no fixed-port conflicts to manage.
    server.listen(preferredPort || 0, "127.0.0.1", () => {
      resolve({ server, port: server.address().port });
    });
  });
}

module.exports = { startStaticServer };
