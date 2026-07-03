#!/usr/bin/env node

const http = require("node:http");
const { URL } = require("node:url");
const { createHash } = require("node:crypto");

const PORT = 4317;
const HOST = "127.0.0.1";

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  response.end(JSON.stringify(payload));
}

function buildArchiveUrl(timestamp, originalUrl) {
  return `https://web.archive.org/web/${timestamp}/${originalUrl}`;
}

function normalizeComparableUrl(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function extractWaybackOriginalUrl(value) {
  const match = String(value || "").trim().match(/^https?:\/\/web\.archive\.org\/web\/\d{8,14}(?:[a-z_]+)?\/(https?:\/\/.+)$/i);
  return match ? decodeURIComponent(match[1]) : "";
}

function formatArchiveDate(timestamp) {
  const value = String(timestamp || "").trim();
  if (!/^\d{14}$/.test(value)) {
    return "";
  }
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

async function handleWaybackLookup(targetUrl) {
  const lookupUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(targetUrl)}&output=json&fl=timestamp,original,statuscode&filter=statuscode:200`;
  const response = await fetch(lookupUrl, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Wayback lookup failed with status ${response.status} ${response.statusText}`.trim());
  }

  const rows = await response.json();
  return Array.isArray(rows)
    ? rows.slice(1)
        .filter((row) => Array.isArray(row) && row[0] && row[1])
        .map((row) => ({
          timestamp: row[0],
          archiveUrl: buildArchiveUrl(row[0], row[1]),
          captureDate: formatArchiveDate(row[0])
        }))
        .filter((snapshot) => snapshot.captureDate)
    : [];
}

async function handleHash(targetUrl) {
  const response = await fetch(targetUrl, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Archive fetch failed with status ${response.status} ${response.statusText}`.trim());
  }

  const arrayBuffer = await response.arrayBuffer();
  return createHash("sha256")
    .update(Buffer.from(arrayBuffer))
    .digest("hex");
}

async function handleVerify(targetUrl, canonicalUrl) {
  const response = await fetch(targetUrl, { redirect: "follow" });
  const finalUrl = response.url || targetUrl;
  const extractedOriginal = extractWaybackOriginalUrl(targetUrl) || extractWaybackOriginalUrl(finalUrl);
  const normalizedCanonical = normalizeComparableUrl(canonicalUrl);
  const matchesCanonical =
    normalizeComparableUrl(extractedOriginal) === normalizedCanonical ||
    normalizeComparableUrl(finalUrl).includes(normalizedCanonical);

  return {
    reachable: response.ok,
    finalUrl,
    matchesCanonical,
    message: response.ok
      ? matchesCanonical
        ? "Archive URL verified by helper."
        : "Archive URL reachable, but the canonical URL did not match."
      : `Archive verification failed with status ${response.status} ${response.statusText}`.trim()
  };
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    response.end();
    return;
  }

  try {
    const requestUrl = new URL(request.url, `http://${HOST}:${PORT}`);

    if (requestUrl.pathname === "/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    const targetUrl = String(requestUrl.searchParams.get("url") || "").trim();
    if (!isHttpUrl(targetUrl)) {
      sendJson(response, 400, { error: "A valid http or https url query parameter is required." });
      return;
    }

    if (requestUrl.pathname === "/wayback") {
      const snapshots = await handleWaybackLookup(targetUrl);
      sendJson(response, 200, { snapshots });
      return;
    }

    if (requestUrl.pathname === "/hash") {
      const sha256 = await handleHash(targetUrl);
      sendJson(response, 200, { sha256 });
      return;
    }

    if (requestUrl.pathname === "/verify") {
      const canonicalUrl = String(requestUrl.searchParams.get("canonical") || "").trim();
      if (!isHttpUrl(canonicalUrl)) {
        sendJson(response, 400, { error: "A valid canonical query parameter is required." });
        return;
      }
      const verification = await handleVerify(targetUrl, canonicalUrl);
      sendJson(response, 200, verification);
      return;
    }

    sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`Archive Assistant helper listening at http://${HOST}:${PORT}\n`);
});
