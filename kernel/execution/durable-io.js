const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { canonicalStringify } = require("../lib/canonical-json");

function ignoreUnsupportedSync(error) {
  if (!["EINVAL", "ENOTSUP", "EPERM", "EISDIR"].includes(error.code)) throw error;
}

function fsyncDirectory(directory) {
  let descriptor;
  try {
    descriptor = fs.openSync(directory, "r");
    fs.fsyncSync(descriptor);
  } catch (error) {
    ignoreUnsupportedSync(error);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function ensureDirectory(directory, mode = 0o700) {
  fs.mkdirSync(directory, { recursive: true, mode });
  return directory;
}

function writeBytesDurable(filePath, bytes, options = {}) {
  ensureDirectory(path.dirname(filePath));
  const descriptor = fs.openSync(filePath, options.flag || "w", options.mode || 0o600);
  try {
    fs.writeFileSync(descriptor, bytes);
    if (options.mode) fs.fchmodSync(descriptor, options.mode);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  fsyncDirectory(path.dirname(filePath));
  return filePath;
}

function atomicReplaceFile(filePath, bytes, options = {}) {
  const directory = path.dirname(filePath);
  ensureDirectory(directory);
  const token = options.token || crypto.randomUUID();
  const temporary = path.join(directory, `.${path.basename(filePath)}.institution-os-${token}.tmp`);
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, "wx", options.mode || 0o600);
    fs.writeFileSync(descriptor, bytes);
    fs.fchmodSync(descriptor, options.mode || 0o600);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, filePath);
    fsyncDirectory(directory);
    return filePath;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}

function writeCanonicalJsonAtomic(filePath, value, options = {}) {
  return atomicReplaceFile(filePath, Buffer.from(`${canonicalStringify(value)}\n`, "utf8"), {
    ...options,
    mode: options.mode || 0o600
  });
}

function unlinkDurable(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Refusing to remove non-regular execution file: ${filePath}.`);
  fs.unlinkSync(filePath);
  fsyncDirectory(path.dirname(filePath));
  return true;
}

module.exports = {
  atomicReplaceFile,
  ensureDirectory,
  fsyncDirectory,
  unlinkDurable,
  writeBytesDurable,
  writeCanonicalJsonAtomic
};
