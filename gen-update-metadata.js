/* Régénère dist/latest.yml à partir de l'installeur SIGNÉ.
   Indispensable : la signature modifie les octets de l'exe, donc le sha512
   calculé par electron-builder (sur l'exe non signé) ne correspond plus.
   electron-updater vérifie ce sha512 → sans ça, la mise à jour échoue. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const dir = "dist";
const version = require("./package.json").version;
const exe = `33ImmortalsOverlay-Setup-${version}.exe`;
const exePath = path.join(dir, exe);

const buf = fs.readFileSync(exePath);
const sha512 = crypto.createHash("sha512").update(buf).digest("base64");
const size = buf.length;

const yml =
  `version: ${version}\n` +
  `files:\n` +
  `  - url: ${exe}\n` +
  `    sha512: ${sha512}\n` +
  `    size: ${size}\n` +
  `path: ${exe}\n` +
  `sha512: ${sha512}\n` +
  `releaseDate: '${new Date().toISOString()}'\n`;

fs.writeFileSync(path.join(dir, "latest.yml"), yml);

// Le blockmap (téléchargement différentiel) devient invalide après signature :
// on le supprime → electron-updater fera un téléchargement complet (fiable).
try { fs.unlinkSync(exePath + ".blockmap"); } catch (e) {}

console.log(`latest.yml régénéré pour l'exe signé (${exe}, ${size} octets)`);
