#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const manifestPath = path.join(process.cwd(), "docs", "archive_manifest.csv");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        value += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(value);
      value = "";
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    value += char;
  }

  row.push(value);
  if (row.some((cell) => cell !== "")) {
    rows.push(row);
  }

  return rows;
}

function encodeCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? "");
          if (/[",\n\r]/.test(text)) {
            return `"${text.replace(/"/g, "\"\"")}"`;
          }
          return text;
        })
        .join(",")
    )
    .join("\r\n");
}

function requireColumnIndex(headers, headerName) {
  const index = headers.indexOf(headerName);
  if (index === -1) {
    throw new Error(`Required CSV column missing: ${headerName}`);
  }
  return index;
}

function isLikelyUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function isSha256(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || "").trim());
}

async function hashArchiveUrl(archiveUrl) {
  const response = await fetch(archiveUrl, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
  }

  const arrayBuffer = await response.arrayBuffer();
  return createHash("sha256")
    .update(Buffer.from(arrayBuffer))
    .digest("hex");
}

async function main() {
  const originalText = fs.readFileSync(manifestPath, "utf8");
  const rows = parseCsv(originalText);
  if (!rows.length) {
    throw new Error("archive_manifest.csv is empty.");
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);
  const sourceIdIndex = requireColumnIndex(headers, "source_id");
  const archiveUrlIndex = requireColumnIndex(headers, "capture_url_recorded");
  const shaIndex = requireColumnIndex(headers, "sha256_recorded");

  const report = {
    totalRows: dataRows.length,
    rowsProcessed: 0,
    hashesGenerated: 0,
    rowsSkipped: 0,
    errors: []
  };

  for (const row of dataRows) {
    const sourceId = String(row[sourceIdIndex] || "").trim();
    const archiveUrl = String(row[archiveUrlIndex] || "").trim();
    const sha = String(row[shaIndex] || "").trim();

    if (!archiveUrl || !isLikelyUrl(archiveUrl)) {
      report.rowsSkipped += 1;
      continue;
    }

    if (isSha256(sha)) {
      report.rowsSkipped += 1;
      continue;
    }

    report.rowsProcessed += 1;

    try {
      const digest = await hashArchiveUrl(archiveUrl);
      row[shaIndex] = digest;
      report.hashesGenerated += 1;
    } catch (error) {
      report.rowsSkipped += 1;
      report.errors.push({
        sourceId: sourceId || "(unknown source)",
        archiveUrl,
        message: error.message
      });
    }
  }

  fs.writeFileSync(manifestPath, `${encodeCsv([headers, ...dataRows])}\r\n`, "utf8");

  console.log(`Total rows: ${report.totalRows}`);
  console.log(`Rows processed: ${report.rowsProcessed}`);
  console.log(`Hashes generated: ${report.hashesGenerated}`);
  console.log(`Rows skipped: ${report.rowsSkipped}`);
  console.log(`Errors encountered: ${report.errors.length}`);

  if (report.errors.length) {
    console.log("");
    for (const error of report.errors) {
      console.log(`${error.sourceId}: ${error.message}`);
      console.log(`  ${error.archiveUrl}`);
    }
  }
}

main().catch((error) => {
  console.error(`archive-batch failed: ${error.message}`);
  process.exit(1);
});
