/* ============================================================
   33 Immortals Overlay — fenêtre légère toujours au-dessus du jeu.
   Charge la carte interactive du site en mode application (?app=1),
   avec une barre de titre propre (déplacer / opacité / réduire / fermer),
   clic-traversant et mise à jour automatique.
   ============================================================ */
const { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage, ipcMain, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const { autoUpdater } = require("electron-updater");

const SITE = "https://33immortals.fr/carte?app=1";
const SETTINGS_URL = "https://33immortals.fr/carte?app=1&panel=1";

/* Réduit le nombre de processus Chromium et la charge CPU pour une simple
   fenêtre (pas d'isolation par site, pas de fonctions superflues). */
app.commandLine.appendSwitch("disable-site-isolation-trials");
app.commandLine.appendSwitch("disable-features", "Translate,site-per-process,IsolateOrigins,SpareRendererForSitePerProcess");
app.commandLine.appendSwitch("renderer-process-limit", "1");

let win = null, tray = null, settingsWin = null, keysWin = null;
let opacity = 1.0;          // 0.3 → 1.0
let clickThrough = false;   // les clics passent au jeu
let updateReady = false;    // une mise à jour est téléchargée et prête
let resizing = false;       // redimensionnement custom en cours (fenêtre transparente)
let gameRunning = false;    // le jeu (33Immortals.exe) est-il lancé ?

/* Journal de mise à jour (dans %AppData%/33 Immortals Overlay/update.log) — utile pour diagnostiquer */
function ulog(msg) {
  try { fs.appendFileSync(path.join(app.getPath("userData"), "update.log"), "[" + new Date().toISOString() + "] " + msg + "\n"); } catch (e) {}
}

/* --- Raccourcis clavier PERSONNALISABLES ---
   Liste des actions + raccourci par défaut ('' = non assigné). Le mappage est
   modifiable dans la fenêtre « Touches » et persisté dans userData/keys.json. */
const ACTIONS = [
  { id: "toggle",           label: "Afficher / masquer la carte", def: "Control+Alt+O" },
  { id: "opacity_up",       label: "Plus opaque",                 def: "Control+Alt+Up" },
  { id: "opacity_down",     label: "Plus transparent",            def: "Control+Alt+Down" },
  { id: "clickthrough",     label: "Clic-traversant",             def: "Control+Alt+C" },
  { id: "settings",         label: "Ouvrir les réglages",         def: "" },
  { id: "quit",             label: "Quitter l'application",       def: "Control+Alt+Q" },
  { id: "var_all",          label: "Type de carte : Tous",        def: "Control+Alt+4" },
  { id: "var_A",            label: "Type de carte : Bleu",        def: "Control+Alt+1" },
  { id: "var_B",            label: "Type de carte : Jaune",       def: "Control+Alt+2" },
  { id: "var_C",            label: "Type de carte : Rose",        def: "Control+Alt+3" },
  { id: "cat_coffre",       label: "Catégorie : Coffre",          def: "" },
  { id: "cat_coffre_elite", label: "Catégorie : Coffre élite",    def: "" },
  { id: "cat_altar",        label: "Catégorie : Autel",           def: "" },
  { id: "cat_secret",       label: "Catégorie : Chambre secrète", def: "" },
];
let keymap = {};
function keysFile() { return path.join(app.getPath("userData"), "keys.json"); }
function loadKeys() {
  keymap = {};
  ACTIONS.forEach((a) => { keymap[a.id] = a.def; });
  try { const j = JSON.parse(fs.readFileSync(keysFile(), "utf8")); Object.keys(j).forEach((k) => { if (k in keymap) keymap[k] = j[k] || ""; }); } catch (e) {}
}
function saveKeys() { try { fs.writeFileSync(keysFile(), JSON.stringify(keymap)); } catch (e) {} }

function createWindow() {
  win = new BrowserWindow({
    width: 620, height: 540, minWidth: 340, minHeight: 280,
    frame: false, transparent: true, resizable: true, skipTaskbar: false,
    backgroundColor: "#00000000", hasShadow: false, title: "33 Immortals Overlay",
    icon: path.join(__dirname, "build", "icon.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  win.setAlwaysOnTop(true, "screen-saver");        // au-dessus même des jeux plein écran (fenêtré/borderless)
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.removeMenu();
  win.loadURL(SITE);
  win.on("closed", () => { win = null; });
}

/* Fenêtre Réglages SÉPARÉE (cadre Windows normal, opaque). Les changements
   sont persistés en localStorage → la carte se synchronise via l'événement
   "storage" (même origine, même session Electron). */
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.show(); settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 360, height: 640, minWidth: 300, minHeight: 360,
    title: "Réglages — 33 Immortals", backgroundColor: "#0b0710",
    alwaysOnTop: true, skipTaskbar: false,
    icon: path.join(__dirname, "build", "icon.ico"),
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "preload.js") },
  });
  settingsWin.removeMenu();
  settingsWin.loadURL(SETTINGS_URL);
  settingsWin.on("closed", () => { settingsWin = null; });
}

/* 3ᵉ fenêtre : éditeur de touches. */
function openKeys() {
  if (keysWin && !keysWin.isDestroyed()) { keysWin.show(); keysWin.focus(); return; }
  keysWin = new BrowserWindow({
    width: 440, height: 640, minWidth: 360, minHeight: 380,
    title: "Touches — 33 Immortals", backgroundColor: "#0b0710",
    alwaysOnTop: true, skipTaskbar: false,
    icon: path.join(__dirname, "build", "icon.ico"),
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "preload.js") },
  });
  keysWin.removeMenu();
  keysWin.loadURL("https://33immortals.fr/touches?app=1&panel=1");
  keysWin.on("closed", () => { keysWin = null; });
}
function broadcastKeys() {
  [win, settingsWin, keysWin].forEach((w) => { if (w && !w.isDestroyed()) w.webContents.send("keys:changed", { actions: ACTIONS, map: keymap }); });
}

/* --- Détection du jeu (process 33Immortals.exe) --- */
function broadcastGame() {
  [win, settingsWin, keysWin].forEach((w) => { if (w && !w.isDestroyed()) w.webContents.send("overlay:game", { running: gameRunning }); });
}
function checkGame() {
  exec('tasklist /FI "IMAGENAME eq 33Immortals.exe" /NH', { windowsHide: true }, (err, stdout) => {
    const running = !err && /33immortals\.exe/i.test(stdout || "");
    if (running !== gameRunning) { gameRunning = running; broadcastGame(); ulog("game " + (running ? "détecté" : "fermé")); }
  });
}

/* Redimensionnement custom : une fenêtre transparente ne peut pas être
   redimensionnée par les bords sous Windows → on suit le curseur depuis la
   poignée (coin bas-droit) tant que le bouton est enfoncé. */
function resizeTick() {
  if (!resizing || !win || win.isDestroyed()) return;
  const p = screen.getCursorScreenPoint();
  const b = win.getBounds();
  const min = win.getMinimumSize();
  const width = Math.max(min[0], p.x - b.x);
  const height = Math.max(min[1], p.y - b.y);
  win.setBounds({ x: b.x, y: b.y, width: width, height: height });
  setTimeout(resizeTick, 16);
}

function broadcastState() {
  if (win && !win.isDestroyed()) win.webContents.send("overlay:state", { opacity, clickThrough });
}
function setOpacity(v) {
  opacity = Math.min(1, Math.max(0.3, v));
  if (win) win.setOpacity(opacity);
  broadcastState();
}
function toggleClickThrough() {
  clickThrough = !clickThrough;
  if (win) win.setIgnoreMouseEvents(clickThrough, { forward: true });
  refreshTray(); broadcastState();
}
function toggleShow() { if (win) (win.isVisible() ? win.hide() : win.show()); }

/* --- contrôles depuis la barre de titre (preload) --- */
ipcMain.on("overlay:min", () => { if (win) win.minimize(); });
ipcMain.on("overlay:close", () => app.quit());
ipcMain.on("overlay:opacity", (_e, v) => setOpacity(Number(v) || 1));
ipcMain.on("overlay:clickthrough", () => toggleClickThrough());
ipcMain.on("overlay:set-ignore", (_e, ignore) => { if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(!!ignore, { forward: true }); });
ipcMain.on("overlay:settings", () => openSettings());
ipcMain.on("overlay:keys", () => openKeys());
ipcMain.on("overlay:close-self", (e) => { const w = BrowserWindow.fromWebContents(e.sender); if (w && !w.isDestroyed()) w.close(); });
ipcMain.handle("keys:get", () => ({ actions: ACTIONS, map: keymap }));
ipcMain.handle("keys:set", (_e, id, accel) => {
  if (id in keymap) {
    accel = (accel || "").trim();
    if (accel) Object.keys(keymap).forEach((k) => { if (k !== id && keymap[k] === accel) keymap[k] = ""; }); // pas de doublon
    keymap[id] = accel;
    saveKeys(); applyShortcuts(); broadcastKeys();
  }
  return { actions: ACTIONS, map: keymap };
});
ipcMain.handle("keys:reset", () => { ACTIONS.forEach((a) => { keymap[a.id] = a.def; }); saveKeys(); applyShortcuts(); broadcastKeys(); return { actions: ACTIONS, map: keymap }; });
ipcMain.handle("overlay:game-get", () => ({ running: gameRunning }));
ipcMain.on("overlay:resize-start", () => { resizing = true; resizeTick(); });
ipcMain.on("overlay:resize-end", () => { resizing = false; });
ipcMain.handle("overlay:get", () => ({ opacity, clickThrough }));

function sendVariant(v) {
  if (win && !win.isDestroyed()) win.webContents.send("overlay:variant", v);
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send("overlay:variant", v);
}
function sendCat(cat) {
  if (win && !win.isDestroyed()) win.webContents.send("overlay:cat", cat);
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send("overlay:cat", cat);
}
function dispatch(id) {
  switch (id) {
    case "toggle": return toggleShow();
    case "opacity_up": return setOpacity(opacity + 0.1);
    case "opacity_down": return setOpacity(opacity - 0.1);
    case "clickthrough": return toggleClickThrough();
    case "settings": return openSettings();
    case "quit": return app.quit();
    case "var_all": return sendVariant("all");
    case "var_A": return sendVariant("A");
    case "var_B": return sendVariant("B");
    case "var_C": return sendVariant("C");
  }
  if (id.indexOf("cat_") === 0) sendCat(id.slice(4));   // catégorie de marqueur
}
function applyShortcuts() {
  globalShortcut.unregisterAll();
  Object.keys(keymap).forEach((id) => {
    const acc = keymap[id];
    if (!acc) return;
    try { globalShortcut.register(acc, () => dispatch(id)); }
    catch (e) { ulog("shortcut KO " + id + " " + acc + " " + (e && e.message)); }
  });
}

function refreshTray() {
  if (!tray) return;
  const items = [
    { label: "Afficher / masquer  (Ctrl+Alt+O)", click: toggleShow },
    { label: "Plus opaque  (Ctrl+Alt+↑)", click: () => setOpacity(opacity + 0.1) },
    { label: "Plus transparent  (Ctrl+Alt+↓)", click: () => setOpacity(opacity - 0.1) },
    { label: (clickThrough ? "✓ " : "") + "Clic-traversant  (Ctrl+Alt+C)", click: toggleClickThrough },
    { type: "separator" },
  ];
  if (updateReady) {
    items.push({ label: "🔄 Redémarrer pour installer la mise à jour", click: () => { try { autoUpdater.quitAndInstall(); } catch (e) { app.quit(); } } });
  } else {
    items.push({ label: "Vérifier les mises à jour", click: () => autoUpdater.checkForUpdates().catch(() => {}) });
  }
  items.push({ label: "Quitter  (Ctrl+Alt+Q)", click: () => app.quit() });
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

function createTray() {
  try {
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, "build", "icon.ico")));
    tray.setToolTip("33 Immortals Overlay");
    refreshTray();
    tray.on("click", toggleShow);
  } catch (e) {}
}

/* --- Mise à jour automatique (electron-updater + flux /app/latest.yml) ---
   À chaque lancement : vérifie, télécharge en arrière-plan, installe à la
   fermeture de l'app. Donc : on relance → MAJ installée. */
function setupUpdates() {
  autoUpdater.autoDownload = true;            // télécharge dès qu'une version est dispo
  autoUpdater.autoInstallOnAppQuit = true;    // installe quand l'utilisateur quitte → effective au relancement
  autoUpdater.logger = { info: ulog, warn: ulog, error: ulog, debug: () => {} };

  autoUpdater.on("checking-for-update", () => ulog("checking-for-update"));
  autoUpdater.on("update-available", (i) => ulog("update-available " + (i && i.version)));
  autoUpdater.on("update-not-available", (i) => ulog("up-to-date " + (i && i.version)));
  autoUpdater.on("error", (e) => ulog("error " + (e && e.message)));
  autoUpdater.on("download-progress", (p) => ulog("downloading " + Math.round(p.percent) + "%"));
  autoUpdater.on("update-downloaded", (i) => {
    ulog("update-downloaded " + (i && i.version) + " — sera installée à la fermeture");
    updateReady = true;
    refreshTray();
    try {
      if (tray && tray.displayBalloon) {
        tray.displayBalloon({ title: "33 Immortals Overlay", content: "Mise à jour " + (i && i.version) + " prête — elle s'installera à la fermeture de l'app." });
      }
    } catch (e) {}
  });

  const check = () => autoUpdater.checkForUpdates().catch((e) => ulog("check failed " + (e && e.message)));
  check();                                   // au lancement
  setInterval(check, 30 * 60 * 1000);        // puis toutes les 30 min (sessions longues)
}

// Instance unique
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on("second-instance", () => { if (win) { win.show(); win.focus(); } });
  app.whenReady().then(() => {
    loadKeys();
    createWindow();
    createTray();
    applyShortcuts();
    setupUpdates();
    checkGame();
    setInterval(checkGame, 5000);   // surveille le lancement / fermeture du jeu
  });
  app.on("will-quit", () => globalShortcut.unregisterAll());
  app.on("window-all-closed", () => { /* reste en zone de notification */ });
}
