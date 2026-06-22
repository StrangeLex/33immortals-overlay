# Contribuer / Contributing

Merci de ton intérêt pour **33 Immortals Overlay** ! 🗺️

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

### Bon à savoir
L'app est une **coquille Electron** minimale qui charge la carte de
`33immortals.fr`. La majorité de l'interface (carte, barre, réglages, touches)
est **servie par le site** — beaucoup d'améliorations ne nécessitent donc aucune
modification de ce dépôt.

- `main.js` — processus principal (fenêtres, raccourcis, opacité, auto-update).
- `preload.js` — pont `contextBridge`.
- `package.json` — config `electron-builder`.

### Proposer une modification
1. Forke le dépôt et crée une branche.
2. Garde les commits clairs et atomiques.
3. Ouvre une Pull Request en décrivant le changement.

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

The app is a minimal **Electron shell** loading the `33immortals.fr` map; most of
the UI is served by the website. Open a Pull Request describing your change.
