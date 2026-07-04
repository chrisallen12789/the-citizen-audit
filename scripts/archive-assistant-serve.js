#!/usr/bin/env node

const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const HOST = "127.0.0.1";
const DEFAULT_PORT = 4175;
const docsRoot = path.resolve(__dirname, "..", "docs");
const requestedPort = Number.parseInt(process.argv[2] || process.env.ARCHIVE_ASSISTANT_PORT || "", 10);
const PORT = Number.isFinite(requestedPort) && requestedPort > 0 ? requestedPort : DEFAULT_PORT;

const CONTENT_TYPES = {
  ".csv": "text/csv; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl, `http://${HOST}:${PORT}`);
  const pathname = url.pathname === "/" ? "/archive-assistant.html" : url.pathname;
  const relativePath = pathname.replace(/^\/+/, "");
  const filePath = path.resolve(docsRoot, relativePath);
  if (!filePath.startsWith(docsRoot)) {
    return null;
  }
  return filePath;
}

async function sendFile(response, filePath) {
  try {
    const data = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": CONTENT_TYPES[extension] || "application/octet-stream"
    });
    response.end(data);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Server error");
  }
}

const server = http.createServer(async (request, response) => {
  const filePath = resolveRequestPath(request.url || "/");
  if (!filePath) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  await sendFile(response, filePath);
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`Archive Assistant server listening at http://${HOST}:${PORT}/archive-assistant.html\n`);
});

server.on("error", (error) => {
  if (error && error.code === "EADDRINUSE") {
    process.stderr.write(
      `Archive Assistant server could not start because port ${PORT} is already in use. ` +
      `Run "node scripts/archive-assistant-serve.js <open-port>" or set ARCHIVE_ASSISTANT_PORT.\n`
    );
    process.exit(1);
    return;
  }

  process.stderr.write(`Archive Assistant server failed: ${error.message}\n`);
  process.exit(1);
});
