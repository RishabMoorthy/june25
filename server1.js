const fs = require("fs");
const path = require("path");
const express = require("express");

// If running as the packaged SEA exe, process.execPath = the exe itself -> use its folder.
// If running via "npm run serve" / "node server.js", process.execPath = node.exe -> use __dirname instead.
const isPackagedExe = path.basename(process.execPath).toLowerCase() !== "node.exe";

const baseDir = isPackagedExe
  ? path.dirname(process.execPath)
  : __dirname;

const CONFIG_PATH = path.join(baseDir, "stubserver_config", "server", "config.properties");

if (!fs.existsSync(CONFIG_PATH)) {
  console.error(`config.properties not found at ${CONFIG_PATH}`);
  process.exit(1);
}

// --- read a single key from config.properties ---
function readProp(file, key) {
  const text = fs.readFileSync(file, "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;        // skip blanks/comments
    const i = line.indexOf("=");
    if (i === -1) continue;
    if (line.slice(0, i).trim() === key) return line.slice(i + 1).trim();
  }
  return undefined;
}

// --- read ui.port (fail clearly if missing) ---
const port = Number(readProp(CONFIG_PATH, "ui.port"));
if (!port) {
  console.error(`ui.port not found / invalid in ${CONFIG_PATH}`);
  process.exit(1);
}

// --- read the two backend ports from the same config file ---
const portalServerPort = readProp(CONFIG_PATH, "portalserver.port"); // -> API_BASE backend
const stubServerPort   = readProp(CONFIG_PATH, "stubserver.port");   // -> BACKEND_API backend

// --- serve the React build/ folder ---
const buildDir = path.join(__dirname, "build");
const app = express();

// serve static assets (js/css/images) as before, but NOT index.html (we handle that below)
app.use(express.static(buildDir, { index: false }));

// --- serve index.html with server ports injected, so URLConfig.js can read them ---
app.get(/.*/, (_req, res) => {
  const html = fs.readFileSync(path.join(buildDir, "index.html"), "utf8");
  const injected = html.replace(
    "</head>",
    `<script>window.__SERVER_CONFIG__={portalServerPort:"${portalServerPort}",stubServerPort:"${stubServerPort}"};</script></head>`
  );
  res.send(injected);
});

app.listen(port, () => console.log(`UI running on port ${port} (config: ${CONFIG_PATH})`));
