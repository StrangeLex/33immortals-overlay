# Contributing / Contribuer

Thanks for your interest in **33 Immortals Overlay**! 🗺️

## 🇬🇧 English

### Requirements
- **Node.js 18+**
- To build the Windows `.exe` from Linux: **wine** (`wine` + `wine32:i386`).

### Development
```bash
npm install
npm start          # run the app in dev mode
npm run build      # outputs dist/33ImmortalsOverlay-Setup-<version>.exe
```

### Good to know
The app is a minimal **Electron shell** that loads the `33immortals.fr` map.
Most of the UI (map, bar, settings, keys) is **served by the website** — so many
improvements need no change to this repository at all.

- `main.js` — main process (windows, shortcuts, opacity, auto-update).
- `preload.js` — `contextBridge` bridge.
- `package.json` — `electron-builder` config.

### Proposing a change
1. Fork the repo and create a branch.
2. Keep commits clear and atomic.
3. Open a Pull Request describing your change.

## 🇫🇷 Français

### Prérequis
- **Node.js 18+**
- Pour compiler le `.exe` Windows depuis Linux : **wine** (`wine` + `wine32:i386`).

### Développement
```bash
npm install
npm start          # lance l'app en mode développement
npm run build      # produit dist/33ImmortalsOverlay-Setup-<version>.exe
```

L'app est une **coquille Electron** minimale qui charge la carte de
`33immortals.fr` ; la majorité de l'interface est servie par le site. Ouvre une
Pull Request en décrivant ton changement.
