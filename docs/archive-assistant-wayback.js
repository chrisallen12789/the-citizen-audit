(function (root, factory) {
  const validation =
    typeof module === "object" && module.exports
      ? require("./archive-assistant-validation.js")
      : root.ArchiveAssistantValidation;
  const api = factory(validation);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.ArchiveAssistantWayback = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (validation) {
  function trimValue(value) {
    return String(value || "").trim();
  }

  function formatArchiveDate(timestamp) {
    const value = trimValue(timestamp);
    if (!/^\d{14}$/.test(value)) {
      return "";
    }
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }

  function buildArchiveUrl(timestamp, originalUrl) {
    return `https://web.archive.org/web/${trimValue(timestamp)}/${trimValue(originalUrl)}`;
  }

  function normalizeSnapshotRecord(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return null;
    }

    const timestamp = trimValue(snapshot.timestamp);
    const archiveUrl = trimValue(snapshot.archiveUrl);
    const captureDate = trimValue(snapshot.captureDate) || formatArchiveDate(timestamp);
    if (!timestamp || !captureDate || !validation.looksLikeWaybackCaptureUrl(archiveUrl)) {
      return null;
    }

    return { timestamp, archiveUrl, captureDate };
  }

  function normalizeWaybackSnapshotRows(rows) {
    return Array.isArray(rows)
      ? rows
          .slice(1)
          .filter((row) => Array.isArray(row) && row[0] && row[1])
          .map((row) =>
            normalizeSnapshotRecord({
              timestamp: row[0],
              archiveUrl: buildArchiveUrl(row[0], row[1]),
              captureDate: formatArchiveDate(row[0])
            })
          )
          .filter(Boolean)
      : [];
  }

  function selectLegacyRepairSnapshot(record, snapshots) {
    const matchingSnapshots = (Array.isArray(snapshots) ? snapshots : []).filter(
      (snapshot) =>
        snapshot &&
        validation.looksLikeWaybackCaptureUrl(snapshot.archiveUrl) &&
        validation.archiveUrlMatchesCanonical(snapshot.archiveUrl, record && record.canonical_url)
    );

    if (!matchingSnapshots.length) {
      return { snapshot: null, reason: "No archived snapshots matched the canonical URL." };
    }

    const captureDate = trimValue(record && record.archive_date);
    if (captureDate) {
      const datedMatches = matchingSnapshots.filter((snapshot) => snapshot.captureDate === captureDate);
      if (datedMatches.length === 1) {
        return { snapshot: datedMatches[0], reason: "" };
      }
      if (datedMatches.length > 1) {
        return {
          snapshot: null,
          reason: "Multiple archived snapshots share the recorded capture date. Select the correct timestamped snapshot manually."
        };
      }
    }

    if (matchingSnapshots.length === 1) {
      return { snapshot: matchingSnapshots[0], reason: "" };
    }

    return {
      snapshot: null,
      reason: "Multiple archived snapshots exist for this canonical URL. Select the correct timestamped snapshot manually."
    };
  }

  function applyLegacyWaybackRepair(record, snapshots) {
    if (
      !record ||
      (!validation.isLegacyWaybackCaptureUrl(record.capture_url_recorded) &&
        !validation.isSavePageNowUrl(record.capture_url_recorded))
    ) {
      return { repaired: false, attention: false };
    }

    const resolution = selectLegacyRepairSnapshot(record, snapshots);
    if (!resolution.snapshot) {
      if (validation.isSavePageNowUrl(record.capture_url_recorded)) {
        const previousUrl = trimValue(record.capture_url_recorded);
        record.capture_url_recorded = "";
        if (trimValue(record.archive_status).toUpperCase() !== "ATTEMPT_FAILED") {
          record.archive_status = "NEEDS_RECAPTURE";
        }
        return {
          repaired: false,
          attention: true,
          previousUrl,
          message:
            "Save Page Now returned no timestamped snapshot. Row remains NEEDS_RECAPTURE until a real Wayback capture exists."
        };
      }
      return {
        repaired: false,
        attention: true,
        message: `Legacy archive URL is missing a Wayback timestamp. ${resolution.reason}`
      };
    }

    const previousUrl = trimValue(record.capture_url_recorded);
    record.capture_url_recorded = resolution.snapshot.archiveUrl;
    if (!trimValue(record.archive_date)) {
      record.archive_date = resolution.snapshot.captureDate;
    }

    return {
      repaired: true,
      attention: false,
      previousUrl,
      archiveUrl: resolution.snapshot.archiveUrl,
      captureDate: record.archive_date
    };
  }

  function getStatusRank(status) {
    switch (trimValue(status).toUpperCase()) {
      case "PENDING":
        return 0;
      case "NEEDS_RECAPTURE":
        return 1;
      case "ATTEMPT_FAILED":
        return 2;
      case "ARCHIVED":
        return 3;
      default:
        return -1;
    }
  }

  function mergeStatus(currentStatus, incomingStatus) {
    const current = trimValue(currentStatus).toUpperCase();
    const incoming = trimValue(incomingStatus).toUpperCase();
    if (!incoming) {
      return currentStatus;
    }
    return getStatusRank(incoming) >= getStatusRank(current) ? incomingStatus : currentStatus;
  }

  function mergeIncomingRecord(currentRecord, incomingRecord, headers) {
    let changed = false;
    headers.forEach((header) => {
      const currentValue = trimValue(currentRecord[header]);
      const nextValue = trimValue(incomingRecord[header]);
      if (!nextValue) {
        return;
      }

      if (header === "archive_status") {
        const mergedStatus = mergeStatus(currentValue, nextValue);
        if (mergedStatus !== currentRecord[header]) {
          currentRecord[header] = mergedStatus;
          changed = true;
        }
        return;
      }

      if (
        header === "capture_url_recorded" &&
        validation.looksLikeWaybackCaptureUrl(currentValue) &&
        !validation.looksLikeWaybackCaptureUrl(nextValue)
      ) {
        return;
      }

      if (
        header === "capture_url_recorded" &&
        (validation.isLegacyWaybackCaptureUrl(currentValue) || validation.isSavePageNowUrl(currentValue)) &&
        validation.looksLikeWaybackCaptureUrl(nextValue)
      ) {
        currentRecord[header] = nextValue;
        changed = true;
        return;
      }

      if (
        header === "capture_url_recorded" &&
        validation.isSavePageNowUrl(nextValue)
      ) {
        return;
      }

      if (
        ["archive_date", "sha256_recorded", "verified_by", "archive_failure_date", "archive_failure_reason", "archive_attempted_url", "notes"].includes(header) &&
        currentValue &&
        !nextValue
      ) {
        return;
      }

      if (nextValue !== currentRecord[header]) {
        currentRecord[header] = nextValue;
        changed = true;
      }
    });

    return changed;
  }

  return {
    applyLegacyWaybackRepair,
    buildArchiveUrl,
    formatArchiveDate,
    mergeIncomingRecord,
    normalizeSnapshotRecord,
    normalizeWaybackSnapshotRows,
    selectLegacyRepairSnapshot
  };
});
