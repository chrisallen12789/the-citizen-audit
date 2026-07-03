const fs = require("fs");
const path = require("path");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFile(publicDir, relativePath, content) {
  const target = path.join(publicDir, relativePath);
  ensureDir(path.dirname(target));
  fs.writeFileSync(target, content, "utf8");
}

function copyFile(publicDir, relativePath, sourcePath) {
  const target = path.join(publicDir, relativePath);
  ensureDir(path.dirname(target));
  fs.copyFileSync(sourcePath, target);
}

module.exports = {
  ensureDir,
  writeFile,
  copyFile
};
