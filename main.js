const { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage, ipcMain, screen, desktopCapturer, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const { autoUpdater } = require("electron-updater");

let appLang = "fr";
function langFile() { return path.join(app.getPath("userData"), "lang.txt"); }
function loadLang() {
  try { const v = fs.readFileSync(langFile(), "utf8").trim(); if (v === "en" || v === "fr" || v === "ru") { appLang = v; return; } } catch (e) {}
  try {
    const loc = (app.getLocale() || "").toLowerCase();
    appLang = loc.indexOf("fr") === 0 ? "fr" : (loc.indexOf("ru") === 0 ? "ru" : "en");
  } catch (e) { appLang = "fr"; }
}
function saveLang() { try { fs.writeFileSync(langFile(), appLang); } catch (e) {} }
function base() { return "https://33immortals.fr" + (appLang === "fr" ? "" : "/" + appLang); }
function urlMap() { return base() + "/carte?app=1"; }
function urlSettings() { return base() + "/carte?app=1&panel=1"; }
function urlHud() { return base() + "/hud?app=1&hud=1"; }
function urlKeys() { return base() + "/touches?app=1&panel=1"; }
function openLinksExternally(w) {
  w.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) { shell.openExternal(url); return { action: "deny" }; }
    return { action: "allow" };
  });
}

app.commandLine.appendSwitch("disable-site-isolation-trials");
app.commandLine.appendSwitch("disable-features", "Translate,site-per-process,IsolateOrigins,SpareRendererForSitePerProcess");
app.commandLine.appendSwitch("renderer-process-limit", "1");

let win = null, tray = null, settingsWin = null, keysWin = null, hudWin = null;
let betaWanted = false;
let opacity = 1.0;
let clickThrough = false;
let updateReady = false;
let updateVersion = "";
const DOWNLOAD_URL = "https://33immortals.fr/download";
let resizing = false;
let gameRunning = false;

function ulog(msg) {
  try { fs.appendFileSync(path.join(app.getPath("userData"), "update.log"), "[" + new Date().toISOString() + "] " + msg + "\n"); } catch (e) {}
}

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
  { id: "cat_boneurn",      label: "Catégorie : Urne d'os",       def: "" },
  { id: "reset_found",      label: "Réactiver les marqueurs trouvés", def: "" },
  { id: "realm_inferno",    label: "Carte : Enfer (Hell)",         def: "" },
  { id: "realm_purgatorio", label: "Carte : Purgatoire (Purgatorio)", def: "" },
  { id: "realm_paradiso",   label: "Carte : Paradis (Paradiso)",   def: "" },
  { id: "realm_next",       label: "Carte suivante (Enfer → Purgatoire → Paradis)", def: "" },
  { id: "map_anim_toggle",  label: "Ouvrir / fermer la carte (animation)", def: "" },
];
let winState = {};
function stateFile() { return path.join(app.getPath("userData"), "winstate.json"); }
function loadState() { try { const s = JSON.parse(fs.readFileSync(stateFile(), "utf8")); if (s && typeof s === "object") winState = s; } catch (e) {} }
function saveState() { try { fs.writeFileSync(stateFile(), JSON.stringify(winState)); } catch (e) {} }
function rememberBounds() {
  if (win && !win.isDestroyed() && !win.isMinimized()) { winState.bounds = win.getBounds(); saveState(); }
}
function boundsOnScreen(b) {
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
  const b = boundsOnScreen(winState.bounds) ? winState.bounds : null;
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
      backgroundThrottling: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setOpacity(opacity);
  win.removeMenu();
  win.loadURL(urlMap());
  openLinksExternally(win);
  win.on("moved", rememberBounds);
  win.on("closed", () => { win = null; });
}

function restoreTopFix(w) {
  w.on("minimize", () => { if (!w.isDestroyed()) w.setAlwaysOnTop(false); });
  w.on("restore", () => { if (!w.isDestroyed()) { w.setAlwaysOnTop(true); w.show(); w.focus(); } });
}
function showWin(w) {
  if (!w || w.isDestroyed()) return;
  if (w.isMinimized()) w.restore();
  w.setAlwaysOnTop(true); w.show(); w.focus();
}

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { showWin(settingsWin); return; }
  settingsWin = new BrowserWindow({
    width: 360, height: 640, minWidth: 300, minHeight: 360,
    title: "Réglages — 33 Immortals", backgroundColor: "#0b0710",
    alwaysOnTop: true, skipTaskbar: false,
    icon: path.join(__dirname, "build", "icon.ico"),
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, preload: path.join(__dirname, "preload.js") },
  });
  settingsWin.removeMenu();
  settingsWin.loadURL(urlSettings());
  openLinksExternally(settingsWin);
  restoreTopFix(settingsWin);
  settingsWin.on("closed", () => { settingsWin = null; });
}

function openKeys() {
  if (keysWin && !keysWin.isDestroyed()) { showWin(keysWin); return; }
  keysWin = new BrowserWindow({
    width: 440, height: 640, minWidth: 360, minHeight: 380,
    title: "Touches — 33 Immortals", backgroundColor: "#0b0710",
    alwaysOnTop: true, skipTaskbar: false,
    icon: path.join(__dirname, "build", "icon.ico"),
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, preload: path.join(__dirname, "preload.js") },
  });
  keysWin.removeMenu();
  keysWin.loadURL(urlKeys());
  openLinksExternally(keysWin);
  restoreTopFix(keysWin);
  keysWin.on("closed", () => { keysWin = null; });
}
function broadcastKeys() {
  [win, settingsWin, keysWin].forEach((w) => { if (w && !w.isDestroyed()) w.webContents.send("keys:changed", { actions: ACTIONS, map: keymap }); });
}

function openHud() {
  if (hudWin && !hudWin.isDestroyed()) return;
  const b = screen.getPrimaryDisplay().bounds;
  hudWin = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    frame: false, transparent: true, resizable: false, movable: false,
    focusable: false, skipTaskbar: true, hasShadow: false, fullscreenable: false,
    backgroundColor: "#00000000",
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, preload: path.join(__dirname, "preload.js") },
  });
  hudWin.setIgnoreMouseEvents(true, { forward: true });
  hudWin.setAlwaysOnTop(true, "screen-saver");
  hudWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  hudWin.removeMenu();
  hudWin.loadURL(urlHud());
  openLinksExternally(hudWin);
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

function broadcastGame() {
  [win, settingsWin, keysWin].forEach((w) => { if (w && !w.isDestroyed()) w.webContents.send("overlay:game", { running: gameRunning }); });
}
function checkGame() {
  exec("tasklist /NH /FO CSV", { windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
    let running = false;
    if (!err && stdout) {
      running = stdout.split(/\r?\n/).some((l) => /immortal/i.test(l) && !/overlay/i.test(l));
    }
    if (running !== gameRunning) { gameRunning = running; broadcastGame(); reconcileHud(); ulog("game " + (running ? "détecté" : "fermé")); }
  });
}

function resizeTick() {
  if (!resizing || !win || win.isDestroyed()) return;
  const p = screen.getCursorScreenPoint();
  const b = win.getBounds();
  const min = win.getMinimumSize();
  const rightX = b.x + b.width;
  const width = Math.max(min[0], rightX - p.x);
  const height = Math.max(min[1], p.y - b.y);
  win.setBounds({ x: rightX - width, y: b.y, width: width, height: height });
  setTimeout(resizeTick, 16);
}

function broadcastState() {
  if (win && !win.isDestroyed()) win.webContents.send("overlay:state", { opacity, clickThrough });
}
function setOpacity(v) {
  opacity = Math.min(1, Math.max(0.3, v));
  if (win) win.setOpacity(opacity);
  winState.opacity = opacity; saveState();
  broadcastState();
}
function toggleClickThrough() {
  clickThrough = !clickThrough;
  if (win) {
    win.setIgnoreMouseEvents(clickThrough, { forward: true });
    win.setFocusable(!clickThrough);
    if (clickThrough) win.blur();
  }
  refreshTray(); broadcastState();
}
function toggleShow() { if (win) (win.isVisible() ? win.hide() : win.show()); }

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
    if (accel) Object.keys(keymap).forEach((k) => { if (k !== id && keymap[k] === accel) keymap[k] = ""; });
    keymap[id] = accel;
    saveKeys(); applyShortcuts(); broadcastKeys();
  }
  return { actions: ACTIONS, map: keymap };
});
ipcMain.handle("keys:reset", () => { ACTIONS.forEach((a) => { keymap[a.id] = a.def; }); saveKeys(); applyShortcuts(); broadcastKeys(); return { actions: ACTIONS, map: keymap }; });
ipcMain.handle("overlay:game-get", () => ({ running: gameRunning }));
ipcMain.on("overlay:beta", (_e, on) => { betaWanted = !!on; reconcileHud(); });
ipcMain.handle("overlay:get-lang", () => appLang);
ipcMain.handle("overlay:version", () => app.getVersion());
ipcMain.on("overlay:set-lang", (_e, lang) => {
  lang = (lang === "en" || lang === "ru") ? lang : "fr";
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
function sendResetFound() {
  [win, settingsWin, hudWin].forEach((w) => { if (w && !w.isDestroyed()) w.webContents.send("overlay:reset-found"); });
}
function sendRealm(realm) {
  if (win && !win.isDestroyed()) win.webContents.send("overlay:realm", realm);
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send("overlay:realm", realm);
}
function sendMapToggle() {
  if (win && !win.isDestroyed()) win.webContents.send("overlay:map-toggle");
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send("overlay:map-toggle");
}
function sendRealmNext() {
  if (win && !win.isDestroyed()) win.webContents.send("overlay:realm-next");
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send("overlay:realm-next");
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
    case "reset_found": return sendResetFound();
    case "realm_inferno": return sendRealm("inferno");
    case "realm_purgatorio": return sendRealm("purgatorio");
    case "realm_paradiso": return sendRealm("paradiso");
    case "realm_next": return sendRealmNext();
    case "map_anim_toggle": return sendMapToggle();
  }
  if (id.indexOf("cat_") === 0) sendCat(id.slice(4));
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

function setupUpdates() {
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
  check();
  setInterval(check, 30 * 60 * 1000);
}

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
    setInterval(checkGame, 5000);
  });
  app.on("will-quit", () => { rememberBounds(); globalShortcut.unregisterAll(); });
  app.on("window-all-closed", () => { });
}
