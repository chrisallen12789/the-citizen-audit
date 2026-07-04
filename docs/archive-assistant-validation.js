(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.ArchiveAssistantValidation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function trimValue(value) {
    return String(value || "").trim();
  }

  function normalizeStatus(value) {
    return trimValue(value).toUpperCase();
  }

  function isLikelyUrl(value) {
    return /^https?:\/\/\S+$/i.test(trimValue(value));
  }

  function looksLikeWaybackCaptureUrl(value) {
    return /^https?:\/\/web\.archive\.org\/web\/\d{14}(?:[a-z_]{1,4})?\/https?:\/\/\S+$/i.test(trimValue(value));
  }

  function isLegacyWaybackCaptureUrl(value) {
    return /^https?:\/\/web\.archive\.org\/web\/https?:\/\/\S+$/i.test(trimValue(value));
  }

  function isSavePageNowUrl(value) {
    return /^https?:\/\/web\.archive\.org\/save\/https?:\/\/\S+$/i.test(trimValue(value));
  }

  function isSha256(value) {
    return /^[a-f0-9]{64}$/i.test(trimValue(value));
  }

  function normalizeComparableUrl(value) {
    return trimValue(value)
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "")
      .toLowerCase();
  }

  function extractWaybackOriginalUrl(value) {
    const match = trimValue(value).match(/^https?:\/\/web\.archive\.org\/web\/\d{6,14}(?:[a-z_]{1,4})?\/(https?:\/\/.+)$/i);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function isFailedStatus(recordOrStatus) {
    const status = normalizeStatus(
      typeof recordOrStatus === "string" ? recordOrStatus : recordOrStatus && recordOrStatus.archive_status
    );
    return status === "ATTEMPT_FAILED" || status === "FAILED";
  }

  function isArchivedStatus(recordOrStatus) {
    const status = normalizeStatus(
      typeof recordOrStatus === "string" ? recordOrStatus : recordOrStatus && recordOrStatus.archive_status
    );
    return status === "ARCHIVED";
  }

  function isNeedsRecaptureStatus(recordOrStatus) {
    const status = normalizeStatus(
      typeof recordOrStatus === "string" ? recordOrStatus : recordOrStatus && recordOrStatus.archive_status
    );
    return status === "NEEDS_RECAPTURE";
  }

  function hasArchiveCompletionFields(record) {
    return (
      isLikelyUrl(record && record.capture_url_recorded) &&
      Boolean(trimValue(record && record.archive_date)) &&
      isSha256(record && record.sha256_recorded) &&
      Boolean(trimValue(record && record.verified_by))
    );
  }

  function archiveUrlMatchesCanonical(captureUrl, canonicalUrl) {
    const normalizedCanonical = normalizeComparableUrl(canonicalUrl);
    if (!normalizedCanonical) {
      return false;
    }

    const originalUrl = extractWaybackOriginalUrl(captureUrl);
    const comparableCapture = normalizeComparableUrl(originalUrl || captureUrl);
    return Boolean(comparableCapture) && comparableCapture === normalizedCanonical;
  }

  function getRowIssues(record, options = {}) {
    const issues = [];
    const requireVerifierForAttemptFailed = options.requireVerifierForAttemptFailed !== false;
    const status = normalizeStatus(record && record.archive_status);

    if (!trimValue(record && record.source_id)) {
      issues.push("Missing source ID.");
    }

    if (!isLikelyUrl(record && record.canonical_url)) {
      issues.push("Canonical URL is missing or invalid.");
    }

    if (!isLikelyUrl(record && record.save_page_now_url)) {
      issues.push("Save Page Now URL is missing or invalid.");
    }

    if (!status) {
      issues.push("Archive Status is required.");
      return issues;
    }

    if (isFailedStatus(status)) {
      const attemptedUrl = trimValue(record && record.archive_attempted_url);
      if (attemptedUrl && !isLikelyUrl(attemptedUrl)) {
        issues.push("Attempted URL must look like an http or https URL.");
      } else if (!attemptedUrl && !isLikelyUrl(record && record.canonical_url)) {
        issues.push("Attempted URL or canonical URL is required for a documented archive failure.");
      }

      if (!trimValue(record && record.archive_failure_date)) {
        issues.push("Failure Date is required for ATTEMPT_FAILED rows.");
      }

      if (!trimValue(record && record.archive_failure_reason)) {
        issues.push("Failure Reason is required for ATTEMPT_FAILED rows.");
      }

      if (requireVerifierForAttemptFailed && !trimValue(record && record.verified_by)) {
        issues.push("Verified By is required for ATTEMPT_FAILED rows.");
      }

      return issues;
    }

    if (!trimValue(record && record.capture_url_recorded)) {
      issues.push("Returned archive URL is required.");
    } else if (!isLikelyUrl(record && record.capture_url_recorded)) {
      issues.push("Returned archive URL must look like an http or https URL.");
    } else if (isSavePageNowUrl(record && record.capture_url_recorded)) {
      issues.push("Returned archive URL cannot be a Save Page Now request URL. Store the timestamped Wayback snapshot URL instead.");
    } else if (isLegacyWaybackCaptureUrl(record && record.capture_url_recorded)) {
      issues.push("Returned archive URL is a legacy Wayback URL without a timestamp. Repair or reselect the timestamped snapshot before export.");
    } else if (!looksLikeWaybackCaptureUrl(record && record.capture_url_recorded)) {
      issues.push("Returned archive URL must be a timestamped Wayback snapshot URL.");
    }

    if (!trimValue(record && record.archive_date)) {
      issues.push("Capture Date is required.");
    }

    if (!trimValue(record && record.sha256_recorded)) {
      issues.push("SHA-256 hash is required.");
    } else if (!isSha256(record && record.sha256_recorded)) {
      issues.push("SHA-256 hash must be a 64-character hexadecimal value.");
    }

    if (!trimValue(record && record.verified_by)) {
      issues.push("Verified By is required.");
    }

    if (
      isNeedsRecaptureStatus(status) &&
      hasArchiveCompletionFields(record) &&
      !archiveUrlMatchesCanonical(record && record.capture_url_recorded, record && record.canonical_url)
    ) {
      issues.push("Returned archive URL does not match the current canonical URL for recapture.");
    }

    return issues;
  }

  function isArchivedComplete(record, options = {}) {
    return isArchivedStatus(record) && getRowIssues(record, options).length === 0;
  }

  function isDocumentedFailure(record, options = {}) {
    return isFailedStatus(record) && getRowIssues(record, options).length === 0;
  }

  function isRowComplete(record, options = {}) {
    return isArchivedComplete(record, options) || isDocumentedFailure(record, options);
  }

  function getAutoPromotionTargetStatus(record, options = {}) {
    const status = normalizeStatus(record && record.archive_status);
    if (!record || !status || isFailedStatus(status)) {
      return status;
    }

    if (status === "PENDING" && hasArchiveCompletionFields(record)) {
      return "ARCHIVED";
    }

    if (
      status === "NEEDS_RECAPTURE" &&
      hasArchiveCompletionFields(record) &&
      archiveUrlMatchesCanonical(record.capture_url_recorded, record.canonical_url) &&
      getRowIssues(record, options).length === 0
    ) {
      return "ARCHIVED";
    }

    return status;
  }

  function applyAutoArchiveStatus(record, options = {}) {
    if (!record) {
      return { changed: false, fromStatus: "", toStatus: "" };
    }

    const currentStatus = normalizeStatus(record.archive_status);
    const targetStatus = getAutoPromotionTargetStatus(record, options);
    if (!targetStatus || targetStatus === currentStatus) {
      return { changed: false, fromStatus: currentStatus, toStatus: currentStatus };
    }

    record.archive_status = targetStatus;
    return { changed: true, fromStatus: currentStatus, toStatus: targetStatus };
  }

  function getCompletionMessage(record, issues, options = {}) {
    const rowIssues = Array.isArray(issues) ? issues : getRowIssues(record, options);

    if (isArchivedComplete(record, options)) {
      return "Archived evidence complete.";
    }

    if (isDocumentedFailure(record, options)) {
      return "Archive failure documented. Archive URL, capture date, and SHA-256 are not required for this status.";
    }

    if (isFailedStatus(record)) {
      return `${rowIssues.length} archive failure documentation item(s) remaining.`;
    }

    if (isNeedsRecaptureStatus(record)) {
      return `${rowIssues.length} archive evidence item(s) still need action for recapture.`;
    }

    return `${rowIssues.length} action item(s) remaining.`;
  }

  return {
    applyAutoArchiveStatus,
    archiveUrlMatchesCanonical,
    extractWaybackOriginalUrl,
    getCompletionMessage,
    getAutoPromotionTargetStatus,
    getRowIssues,
    hasArchiveCompletionFields,
    isArchivedComplete,
    isArchivedStatus,
    isDocumentedFailure,
    isFailedStatus,
    isLegacyWaybackCaptureUrl,
    isLikelyUrl,
    isSavePageNowUrl,
    isNeedsRecaptureStatus,
    isRowComplete,
    isSha256,
    looksLikeWaybackCaptureUrl,
    normalizeStatus
  };
});
