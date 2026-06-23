/* Pont sécurisé entre la page (carte du site) et l'app Electron.
   Marque la page comme « dans l'overlay » (affiche la barre de titre)
   et expose les contrôles de la fenêtre. */
const { contextBridge, ipcRenderer } = require("electron");

function markOverlay() {
  if (document.documentElement) document.documentElement.classList.add("in-overlay");
}
markOverlay();
document.addEventListener("DOMContentLoaded", markOverlay);

contextBridge.exposeInMainWorld("overlay", {
  minimize: () => ipcRenderer.send("overlay:min"),
  close: () => ipcRenderer.send("overlay:close"),
  setOpacity: (v) => ipcRenderer.send("overlay:opacity", v),
  toggleClickThrough: () => ipcRenderer.send("overlay:clickthrough"),
  setIgnore: (ignore) => ipcRenderer.send("overlay:set-ignore", ignore),
  openSettings: () => ipcRenderer.send("overlay:settings"),
  openKeys: () => ipcRenderer.send("overlay:keys"),
  closeSelf: () => ipcRenderer.send("overlay:close-self"),
  getKeys: () => ipcRenderer.invoke("keys:get"),
  setKey: (id, accel) => ipcRenderer.invoke("keys:set", id, accel),
  resetKeys: () => ipcRenderer.invoke("keys:reset"),
  onKeysChanged: (cb) => ipcRenderer.on("keys:changed", (_e, d) => cb(d)),
  onCat: (cb) => ipcRenderer.on("overlay:cat", (_e, c) => cb(c)),
  onResetFound: (cb) => ipcRenderer.on("overlay:reset-found", () => cb()),
  onRealm: (cb) => ipcRenderer.on("overlay:realm", (_e, r) => cb(r)),
  onRealmNext: (cb) => ipcRenderer.on("overlay:realm-next", () => cb()),
  onMapToggle: (cb) => ipcRenderer.on("overlay:map-toggle", () => cb()),
  getGame: () => ipcRenderer.invoke("overlay:game-get"),
  onGame: (cb) => ipcRenderer.on("overlay:game", (_e, s) => cb(s)),
  getScreenSource: () => ipcRenderer.invoke("overlay:screen-source"),
  setBeta: (on) => ipcRenderer.send("overlay:beta", on),
  getLang: () => ipcRenderer.invoke("overlay:get-lang"),
  setLang: (l) => ipcRenderer.send("overlay:set-lang", l),
  getVersion: () => ipcRenderer.invoke("overlay:version"),
  resizeStart: () => ipcRenderer.send("overlay:resize-start"),
  resizeEnd: () => ipcRenderer.send("overlay:resize-end"),
  getState: () => ipcRenderer.invoke("overlay:get"),
  onState: (cb) => ipcRenderer.on("overlay:state", (_e, s) => cb(s)),
  onVariant: (cb) => ipcRenderer.on("overlay:variant", (_e, v) => cb(v)),
});
