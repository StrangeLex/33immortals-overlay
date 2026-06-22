<div align="center">

<img src="https://33immortals.fr/favicon-512.png" alt="33 Immortals Overlay" width="110" />

# 33 Immortals Overlay

**🗺️ La carte interactive de _33 Immortals_, en superposition par-dessus le jeu.**
**🗺️ The _33 Immortals_ interactive map, as an overlay on top of the game.**

[![Télécharger / Download](https://img.shields.io/badge/⬇️_T%C3%A9l%C3%A9charger_%7C_Download-Windows-e8a83c?style=for-the-badge)](https://33immortals.fr/download)

![Windows](https://img.shields.io/badge/Windows_10_/_11-64--bit-0078D6?style=flat-square&logo=windows&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-31-47848F?style=flat-square&logo=electron&logoColor=white)
![Auto-update](https://img.shields.io/badge/Mise_%C3%A0_jour_auto-%E2%9C%93-2ea44f?style=flat-square)
![License](https://img.shields.io/badge/licence-voir_LICENSE-blue?style=flat-square)

<img src="https://33immortals.fr/img/keyart.png" alt="33 Immortals" width="100%" />

</div>

> ⚠️ **FR —** Projet de fans **non-officiel**. _33 Immortals®_ — © [Thunder Lotus Games](https://thunderlotusgames.com). Application ni affiliée ni soutenue par Thunder Lotus Games.
> ⚠️ **EN —** Unofficial **fan-made** project. _33 Immortals®_ — © [Thunder Lotus Games](https://thunderlotusgames.com). This app is not affiliated with nor endorsed by Thunder Lotus Games.

---

## 🇫🇷 Français

Application **overlay (superposition)** qui affiche la carte communautaire de [33immortals.fr](https://33immortals.fr) dans une fenêtre transparente, toujours au-dessus du jeu, avec opacité réglable et mode coopératif.

### ✨ Fonctionnalités
- 🗺️ Carte toujours au-dessus du jeu (fenêtré / sans bordure / 2ᵉ écran)
- 🌓 Fond **transparent** + **opacité réglable** : tu vois le jeu derrière
- 🖱️ **Clic-traversant** : tes clics passent au jeu
- 👥 **Coop** : rejoins la partie d'un ami avec un lien + un pseudo (sans compte)
- ⚙️ Fenêtre **Réglages** + ⌨️ **raccourcis 100 % personnalisables**
- 🔄 **Mises à jour automatiques**

### ⬇️ Télécharger
Windows 64 bits (10 & 11) : **<https://33immortals.fr/download>**
> Non signé par un certificat payant → SmartScreen peut afficher « Windows a protégé votre ordinateur ». Ce n'est pas un virus : **Informations complémentaires → Exécuter quand même**.

### ⌨️ Raccourcis par défaut
| Raccourci | Action |
|---|---|
| `Ctrl + Alt + O` | Afficher / masquer |
| `Ctrl + Alt + ↑` / `↓` | Plus / moins opaque |
| `Ctrl + Alt + C` | Clic-traversant |
| `Ctrl + Alt + Q` | Quitter |
| `Ctrl + Alt + & é " '` | Type de carte : Bleu / Jaune / Rose / Tous |

Tout est modifiable dans la fenêtre **Touches** (une touche par catégorie de marqueur incluse, non assignée par défaut).

---

## 🇬🇧 English

An **overlay** app that displays the [33immortals.fr](https://33immortals.fr) community map in a transparent, always-on-top window, with adjustable opacity and a co-op mode.

### ✨ Features
- 🗺️ Map always on top of the game (windowed / borderless / 2nd monitor)
- 🌓 **Transparent** background + **adjustable opacity**: see the game behind
- 🖱️ **Click-through**: your clicks pass to the game
- 👥 **Co-op**: join a friend's party with a link + nickname (no account)
- ⚙️ **Settings** window + ⌨️ **fully customizable shortcuts**
- 🔄 **Automatic updates**

### ⬇️ Download
Windows 64-bit (10 & 11): **<https://33immortals.fr/download>**
> Not signed with a paid certificate → SmartScreen may show "Windows protected your PC". It's not a virus: **More info → Run anyway**.

### ⌨️ Default shortcuts
| Shortcut | Action |
|---|---|
| `Ctrl + Alt + O` | Show / hide |
| `Ctrl + Alt + ↑` / `↓` | More / less opaque |
| `Ctrl + Alt + C` | Click-through |
| `Ctrl + Alt + Q` | Quit |
| `Ctrl + Alt + 1 2 3 4` | Map type: Blue / Yellow / Pink / All |

Everything is editable in the **Keys** window (one shortcut per marker category included, unbound by default).

---

## 🖼️ Aperçu / Preview

<div align="center">

_La carte en superposition, en jeu / The map overlaid, in-game_

<img src="https://33immortals.fr/screen/screen1.png" width="80%" />
<br/>
<img src="https://33immortals.fr/screen/screen2.png" width="49%" />
<img src="https://33immortals.fr/screen/screen3.png" width="49%" />

</div>

---

## 🛠️ Build / Compiler

**Node.js 18+**. Pour compiler le `.exe` Windows depuis Linux : **wine** (`wine` + `wine32:i386`).
To build the Windows `.exe` from Linux you need **wine** (`wine` + `wine32:i386`).

```bash
npm install
npm run build      # electron-builder → dist/33ImmortalsOverlay-Setup-<version>.exe
npm start          # dev
```

### 🏗️ Architecture
Coquille **[Electron](https://www.electronjs.org/)** minimale qui charge `33immortals.fr/carte?app=1`. Toute l'UI est servie par le site → la plupart des évolutions se font **sans réinstaller**. / Minimal **Electron** shell loading `33immortals.fr/carte?app=1`; the whole UI is served by the website, so most changes ship **without reinstalling**.

- `main.js` — fenêtre transparente always-on-top, opacité, clic-traversant, fenêtres Réglages & Touches, raccourcis globaux, auto-update.
- `preload.js` — pont `contextBridge` page ↔ app.
- `package.json` — config `electron-builder` (NSIS + flux de mise à jour).

## 📄 Licence / License
Voir / see [`LICENSE`](LICENSE).
