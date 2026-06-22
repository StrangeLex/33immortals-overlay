/* ============================================================
   33 Immortals Overlay — fenêtre légère toujours au-dessus du jeu.
   Charge la carte interactive du site en mode application (?app=1),
   avec une barre de titre propre (déplacer / opacité / réduire / fermer),
   clic-traversant et mise à jour automatique.
   ============================================================ */
const { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage, ipcMain, screen, desktopCapturer, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const { autoUpdater } = require("electron-updater");

/* Langue de l'app (fr/en) — persistée ; pilote le préfixe d'URL du site. */
let appLang = "fr";
function langFile() { return path.join(app.getPath("userData"), "lang.txt"); }
function loadLang() {
  // 1) choix manuel mémorisé ; 2) sinon langue de l'OS (fr → français, autre → anglais)
  try { const v = fs.readFileSync(langFile(), "utf8").trim(); if (v === "en" || v === "fr") { appLang = v; return; } } catch (e) {}
  try { appLang = (app.getLocale() || "").toLowerCase().indexOf("fr") === 0 ? "fr" : "en"; } catch (e) { appLang = "fr"; }
}
function saveLang() { try { fs.writeFileSync(langFile(), appLang); } catch (e) {} }
function base() { return "https://33immortals.fr" + (appLang === "en" ? "/en" : ""); }
function urlMap() { return base() + "/carte?app=1"; }
function urlSettings() { return base() + "/carte?app=1&panel=1"; }
function urlHud() { return base() + "/hud?app=1&hud=1"; }
function urlKeys() { return base() + "/touches?app=1&panel=1"; }

/* Réduit le nombre de processus Chromium et la charge CPU pour une simple
   fenêtre (pas d'isolation par site, pas de fonctions superflues). */
app.commandLine.appendSwitch("disable-site-isolation-trials");
app.commandLine.appendSwitch("disable-features", "Translate,site-per-process,IsolateOrigins,SpareRendererForSitePerProcess");
app.commandLine.appendSwitch("renderer-process-limit", "1");

let win = null, tray = null, settingsWin = null, keysWin = null, hudWin = null;
let betaWanted = false;     // mode bêta activé (pour le HUD plein écran)
let opacity = 1.0;          // 0.3 → 1.0
let clickThrough = false;   // les clics passent au jeu
let updateReady = false;    // une mise à jour est téléchargée, prête à installer
let updateVersion = "";
const DOWNLOAD_URL = "https://33immortals.fr/download";
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
/* Mémorisation de la fenêtre (position, taille, opacité) entre les sessions. */
let winState = {};
function stateFile() { return path.join(app.getPath("userData"), "winstate.json"); }
function loadState() { try { const s = JSON.parse(fs.readFileSync(stateFile(), "utf8")); if (s && typeof s === "object") winState = s; } catch (e) {} }
function saveState() { try { fs.writeFileSync(stateFile(), JSON.stringify(winState)); } catch (e) {} }
function rememberBounds() {
  if (win && !win.isDestroyed() && !win.isMinimized()) { winState.bounds = win.getBounds(); saveState(); }
}
function boundsOnScreen(b) {   // évite une fenêtre restaurée hors écran
  if (!b) return false;
  return screen.getAllDisplays().some((d) => {
    const w = d.workArea;
    return b.x < w.x + w.width - 40 && b.x + b.width > w.x + 40 && b.y < w.y + w.height - 20 && b.y + b.height > w.y + 20;
  });
}

let keymap = {};
function keysFile() { return path.join(app.getPath("userData"), "keys.json"); }
function loadKeys() {
  keymap = {};
  ACTIONS.forEach((a) => { keymap[a.id] = a.def; });
  try { const j = JSON.parse(fs.readFileSync(keysFile(), "utf8")); Object.keys(j).forEach((k) => { if (k in keymap) keymap[k] = j[k] || ""; }); } catch (e) {}
}
function saveKeys() { try { fs.writeFileSync(keysFile(), JSON.stringify(keymap)); } catch (e) {} }

function createWindow() {
  const b = boundsOnScreen(winState.bounds) ? winState.bounds : null;   // restaure la position si valide
  if (typeof winState.opacity === "number") opacity = Math.min(1, Math.max(0.3, winState.opacity));
  win = new BrowserWindow({
    x: b ? b.x : undefined, y: b ? b.y : undefined,
    width: b ? b.width : 620, height: b ? b.height : 540, minWidth: 340, minHeight: 280,
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
  win.setOpacity(opacity);                         // restaure l'opacité mémorisée
  win.removeMenu();
  win.loadURL(urlMap());
  win.on("moved", rememberBounds);                 // mémorise la position au déplacement
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
  settingsWin.loadURL(urlSettings());
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
  keysWin.loadURL(urlKeys());
  keysWin.on("closed", () => { keysWin = null; });
}
function broadcastKeys() {
  [win, settingsWin, keysWin].forEach((w) => { if (w && !w.isDestroyed()) w.webContents.send("keys:changed", { actions: ACTIONS, map: keymap }); });
}

/* --- HUD plein écran : marqueurs alignés sur la carte du jeu (bêta) --- */
function openHud() {
  if (hudWin && !hudWin.isDestroyed()) return;
  const b = screen.getPrimaryDisplay().bounds;
  hudWin = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    frame: false, transparent: true, resizable: false, movable: false,
    focusable: false, skipTaskbar: true, hasShadow: false, fullscreenable: false,
    backgroundColor: "#00000000",
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "preload.js") },
  });
  hudWin.setIgnoreMouseEvents(true, { forward: true });   // jamais bloquant pour le jeu
  hudWin.setAlwaysOnTop(true, "screen-saver");
  hudWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  hudWin.removeMenu();
  hudWin.loadURL(urlHud());
  hudWin.on("closed", () => { hudWin = null; });
  ulog("HUD ouvert");
}
function closeHud() {
  if (hudWin && !hudWin.isDestroyed()) hudWin.close();
  hudWin = null;
}
function reconcileHud() {
  if (betaWanted && gameRunning) openHud(); else closeHud();
}

/* --- Détection du jeu (process 33Immortals.exe) --- */
function broadcastGame() {
  [win, settingsWin, keysWin].forEach((w) => { if (w && !w.isDestroyed()) w.webContents.send("overlay:game", { running: gameRunning }); });
}
function checkGame() {
  // Liste tous les process et cherche un .exe contenant « immortal » MAIS pas « overlay »
  // (pour ne pas se détecter soi-même : « 33 Immortals Overlay.exe »).
  exec("tasklist /NH /FO CSV", { windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
    let running = false;
    if (!err && stdout) {
      running = stdout.split(/\r?\n/).some((l) => /immortal/i.test(l) && !/overlay/i.test(l));
    }
    if (running !== gameRunning) { gameRunning = running; broadcastGame(); reconcileHud(); ulog("game " + (running ? "détecté" : "fermé")); }
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
  winState.opacity = opacity; saveState();         // mémorise l'opacité
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
ipcMain.on("overlay:beta", (_e, on) => { betaWanted = !!on; reconcileHud(); });
ipcMain.handle("overlay:get-lang", () => appLang);
ipcMain.on("overlay:set-lang", (_e, lang) => {
  lang = (lang === "en") ? "en" : "fr";
  if (lang === appLang) return;
  appLang = lang; saveLang();
  if (win && !win.isDestroyed()) win.loadURL(urlMap());
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.loadURL(urlSettings());
  if (keysWin && !keysWin.isDestroyed()) keysWin.loadURL(urlKeys());
  if (hudWin && !hudWin.isDestroyed()) hudWin.loadURL(urlHud());
});
ipcMain.handle("overlay:screen-source", async () => {
  try {
    const sources = await desktopCapturer.getSources({ types: ["screen"] });
    return sources && sources[0] ? sources[0].id : null;
  } catch (e) { ulog("screen-source KO " + (e && e.message)); return null; }
});
ipcMain.on("overlay:resize-start", () => { resizing = true; resizeTick(); });
ipcMain.on("overlay:resize-end", () => { resizing = false; rememberBounds(); });
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
    items.push({ label: "🔄 Redémarrer pour installer la mise à jour " + updateVersion, click: () => { try { autoUpdater.quitAndInstall(); } catch (e) { app.quit(); } } });
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
    tray.on("balloon-click", () => { if (updateReady) { try { autoUpdater.quitAndInstall(); } catch (e) {} } });
  } catch (e) {}
}

/* --- Mise à jour automatique (electron-updater + flux /app/latest.yml) ---
   À chaque lancement : vérifie, télécharge en arrière-plan, installe à la
   fermeture de l'app. Donc : on relance → MAJ installée. */
function setupUpdates() {
  // Auto-update ACTIF : télécharge en arrière-plan, installe à la fermeture
  // → l'app est à jour au relancement suivant. (Provider github, flux latest.yml.)
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = { info: ulog, warn: ulog, error: ulog, debug: () => {} };

  autoUpdater.on("update-available", (i) => ulog("update-available " + (i && i.version)));
  autoUpdater.on("update-not-available", () => ulog("up-to-date"));
  autoUpdater.on("error", (e) => ulog("update error " + (e && e.message)));
  autoUpdater.on("download-progress", (p) => ulog("downloading " + Math.round(p.percent) + "%"));
  autoUpdater.on("update-downloaded", (i) => {
    updateReady = true; updateVersion = (i && i.version) ? "v" + i.version : "";
    ulog("update-downloaded " + updateVersion + " — installée à la fermeture");
    refreshTray();
    try {
      if (tray && tray.displayBalloon) {
        tray.displayBalloon({ title: "33 Immortals Overlay", content: "Mise à jour " + updateVersion + " prête — installée à la fermeture (ou clique pour redémarrer maintenant)." });
      }
    } catch (e) {}
  });

  const check = () => autoUpdater.checkForUpdates().catch((e) => ulog("check failed " + (e && e.message)));
  check();                                   // au lancement
  setInterval(check, 30 * 60 * 1000);        // re-vérifie toutes les 30 min
}

// Instance unique
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on("second-instance", () => { if (win) { win.show(); win.focus(); } });
  app.whenReady().then(() => {
    loadLang();
    loadKeys();
    loadState();
    createWindow();
    createTray();
    applyShortcuts();
    setupUpdates();
    checkGame();
    setInterval(checkGame, 5000);   // surveille le lancement / fermeture du jeu
  });
  app.on("will-quit", () => { rememberBounds(); globalShortcut.unregisterAll(); });
  app.on("window-all-closed", () => { /* reste en zone de notification */ });
}
