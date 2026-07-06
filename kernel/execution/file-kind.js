const fs = require("fs");

function fileKind(targetPath) {
  const stat = fs.lstatSync(targetPath);
  if (stat.isSymbolicLink()) return "link";
  if (stat.isFile()) return "file";
  if (stat.isDirectory()) return "directory";
  return "other";
}

module.exports = { fileKind };
