const fs = require("fs");

function moveFile(sourcePath, destinationPath) {
  fs.renameSync(sourcePath, destinationPath);
  return destinationPath;
}

module.exports = { moveFile };
