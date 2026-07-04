(function (root, factory) {
  const validation =
    typeof module === "object" && module.exports
      ? require("./archive-assistant-validation.js")
      : root.ArchiveAssistantValidation;
  const api = factory(validation);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.ArchiveAssistantExport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (validation) {
  const FINAL_EXPORT_FILE_NAME = "archive_manifest_authoritative.csv";
  const FINAL_EXPORT_SIDECAR_FILE_NAME = "archive_manifest_authoritative.sha256.txt";

  function trimValue(value) {
    return String(value || "").trim();
  }

  function encodeCsv(rows) {
    return rows
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? "");
            if (/[",\r\n]/.test(text)) {
              return `"${text.replace(/"/g, "\"\"")}"`;
            }
            return text;
          })
          .join(",")
      )
      .join("\r\n");
  }

  function recordToRow(headers, record) {
    return headers.map((header) => String(record[header] || ""));
  }

  function countByStatus(records) {
    return records.reduce((counts, record) => {
      const status = validation.normalizeStatus(record.archive_status) || "PENDING";
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});
  }

  function runLocalFinalConsistencyCheck({ records, duplicates = {}, expectedRowCount = 43 }) {
    const requiredIssues = [];
    const warnings = [];
    let documentedFailureCount = 0;
    let missingArchiveEvidenceCount = 0;
    let undocumentedFailureCount = 0;

    if (records.length !== expectedRowCount) {
      requiredIssues.push(`Expected ${expectedRowCount} total rows, found ${records.length}.`);
    }

    records.forEach((record) => {
      const prefix = record.source_id || "(unknown source)";
      const rowIssues = validation.getRowIssues(record);
      rowIssues.forEach((issue) => requiredIssues.push(`${prefix}: ${issue}`));
      if (
        validation.isArchivedComplete(record) &&
        record.capture_url_recorded &&
        !validation.looksLikeWaybackCaptureUrl(record.capture_url_recorded)
      ) {
        requiredIssues.push(`${prefix}: archive URL must be a timestamped Wayback snapshot URL.`);
      }

      if (validation.isDocumentedFailure(record)) {
        documentedFailureCount += 1;
      } else if (validation.isFailedStatus(record)) {
        undocumentedFailureCount += 1;
      } else if (!validation.isRowComplete(record)) {
        missingArchiveEvidenceCount += 1;
      }
    });

    if (duplicates.canonical && duplicates.canonical.size) {
      warnings.push(`${duplicates.canonical.size} duplicate canonical URL group(s) detected.`);
    }
    if (duplicates.archive && duplicates.archive.size) {
      warnings.push(`${duplicates.archive.size} duplicate archive URL group(s) detected.`);
    }
    if (duplicates.sha && duplicates.sha.size) {
      warnings.push(`${duplicates.sha.size} duplicate SHA-256 group(s) detected.`);
    }
    if (documentedFailureCount) {
      warnings.push(`${documentedFailureCount} documented archive failure row(s) present.`);
    }
    if (undocumentedFailureCount) {
      warnings.push(`${undocumentedFailureCount} archive failure row(s) still need failure documentation.`);
    }
    if (missingArchiveEvidenceCount) {
      warnings.push(`${missingArchiveEvidenceCount} row(s) still missing archive evidence.`);
    }

    return {
      requiredIssues,
      warnings,
      statusCounts: countByStatus(records),
      documentedFailureCount,
      missingArchiveEvidenceCount,
      undocumentedFailureCount
    };
  }

  async function buildFinalExportArtifacts({
    headers,
    records,
    computeManifestHash,
    exportFileName = FINAL_EXPORT_FILE_NAME,
    sidecarFileName = FINAL_EXPORT_SIDECAR_FILE_NAME
  }) {
    if (typeof computeManifestHash !== "function") {
      throw new Error("A computeManifestHash function is required.");
    }

    const csvRows = [headers, ...records.map((record) => recordToRow(headers, record))];
    const csvText = `${encodeCsv(csvRows)}\r\n`;
    const manifestHash = await computeManifestHash(csvText);
    const sidecarText = `${manifestHash}  ${exportFileName}\r\n`;

    return {
      csvText,
      manifestHash,
      exportFileName,
      sidecarFileName,
      sidecarText
    };
  }

  async function runAdvisoryVerificationSweep({
    records,
    verifyRecord,
    logWarning = null
  }) {
    const warnings = [];
    if (typeof verifyRecord !== "function") {
      return warnings;
    }

    for (const record of records) {
      if (!validation.isLikelyUrl(record.capture_url_recorded)) {
        continue;
      }

      const prefix = record.source_id || "(unknown source)";
      try {
        const verification = await verifyRecord(record);
        if (!verification) {
          continue;
        }

        if (verification.status === "failed" || verification.status === "unverified") {
          const message = `${prefix}: ${trimValue(verification.message) || "Archive URL not verified by tool."}`;
          warnings.push(message);
          if (typeof logWarning === "function") {
            logWarning(record, message, verification);
          }
        }
      } catch (error) {
        const message = `${prefix}: Archive verification warning: ${error.message}`;
        warnings.push(message);
        if (typeof logWarning === "function") {
          logWarning(record, message, {
            status: "unverified",
            verifiedBy: "exception",
            message,
            error
          });
        }
      }
    }

    return warnings;
  }

  return {
    FINAL_EXPORT_FILE_NAME,
    FINAL_EXPORT_SIDECAR_FILE_NAME,
    buildFinalExportArtifacts,
    runAdvisoryVerificationSweep,
    runLocalFinalConsistencyCheck
  };
});
