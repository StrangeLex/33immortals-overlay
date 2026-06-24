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

try { fs.unlinkSync(exePath + ".blockmap"); } catch (e) {}

console.log(`latest.yml régénéré pour l'exe signé (${exe}, ${size} octets)`);
