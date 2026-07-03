#!/usr/bin/env node

const { createHash } = require("node:crypto");

async function main() {
  const targetUrl = String(process.argv[2] || "").trim();

  if (!/^https?:\/\//i.test(targetUrl)) {
    console.error("Usage: node scripts/archive-sha256.js <http-or-https-archive-url>");
    process.exit(1);
  }

  const response = await fetch(targetUrl, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status} ${response.statusText}`.trim());
  }

  const arrayBuffer = await response.arrayBuffer();
  const digest = createHash("sha256")
    .update(Buffer.from(arrayBuffer))
    .digest("hex");

  process.stdout.write(`${digest}\n`);
}

main().catch((error) => {
  console.error(`archive-sha256 failed: ${error.message}`);
  process.exit(1);
});
