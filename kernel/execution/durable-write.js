const fs = require("fs");

function durableWrite(targetPath, bytes, mode = 0o600) {
  const descriptor = fs.openSync(targetPath, "w", mode);
  try {
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  return targetPath;
}

module.exports = { durableWrite };
