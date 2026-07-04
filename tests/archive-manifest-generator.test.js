const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  countManifestStatuses,
  generateArchiveManifest,
  mergeArchiveManifest,
  parseAnnotatedUrlField,
  validateManifestPreservation,
  validateManifestRows
} = require("../scripts/archive-manifest-generator");

function withTempDir(fn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "archive-manifest-test-"));
  try {
    return fn(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function buildConfig(tempDir, manifestSourceIds) {
  const configPath = path.join(tempDir, "config.json");
  writeFile(
    configPath,
    JSON.stringify(
      {
        manifestSourceIds,
        sourceOverrides: [
          {
            sourceId: "S-0006",
            canonicalUrl: "https://www.congress.gov/bill/119th-congress/house-bill/1968",
            reason: "Bill record documented elsewhere in the same research package."
          },
          {
            sourceId: "S-0105",
            canonicalUrl:
              "https://www.vaoig.gov/sites/default/files/reports/2025-03/vaoig-24-03692-76_final_redacted.pdf",
            reason: "Specific PDF URL documented elsewhere in the same research package."
          },
          {
            sourceId: "S-0106",
            canonicalUrl:
              "https://www.vaoig.gov/sites/default/files/reports/2025-05/vaoig-24-03127-66-final-locked.pdf",
            reason: "Specific PDF URL documented elsewhere in the same research package."
          }
        ],
        duplicateCanonicalUrlWhitelist: [],
        duplicateSha256Whitelist: []
      },
      null,
      2
    )
  );
  return configPath;
}

test("parseAnnotatedUrlField preserves URL followed by parenthetical annotation", () => {
  const result = parseAnnotatedUrlField(
    "https://www.congress.gov/bill/119th-congress/house-bill/1968 (H.R. 1968 / P.L. 119-4 bill record)"
  );

  assert.equal(
    result.canonicalUrl,
    "https://www.congress.gov/bill/119th-congress/house-bill/1968"
  );
  assert.equal(result.annotation, "(H.R. 1968 / P.L. 119-4 bill record)");
});

test("parseAnnotatedUrlField preserves URLs that contain literal or encoded parentheses", () => {
  const literalParentheses = parseAnnotatedUrlField(
    "https://example.com/reports/report(1).pdf (annotated PDF)"
  );
  const encodedParentheses = parseAnnotatedUrlField(
    "https://uscode.house.gov/view.xhtml?req=%28title%3A8+section%3A1641+edition%3Aprelim%29 (current edition query)"
  );

  assert.equal(literalParentheses.canonicalUrl, "https://example.com/reports/report(1).pdf");
  assert.equal(literalParentheses.annotation, "(annotated PDF)");
  assert.equal(
    encodedParentheses.canonicalUrl,
    "https://uscode.house.gov/view.xhtml?req=%28title%3A8+section%3A1641+edition%3Aprelim%29"
  );
  assert.equal(encodedParentheses.annotation, "(current edition query)");
});

test("parseAnnotatedUrlField preserves URL followed by descriptive text", () => {
  const result = parseAnnotatedUrlField(
    "https://www.vaoig.gov/sites/default/files/reports/2025-05/vaoig-24-03127-66-final-locked.pdf direct PDF"
  );

  assert.equal(
    result.canonicalUrl,
    "https://www.vaoig.gov/sites/default/files/reports/2025-05/vaoig-24-03127-66-final-locked.pdf"
  );
  assert.equal(result.annotation, "direct PDF");
});

test("generateArchiveManifest preserves statuses and emits exact bill and PDF URLs", () =>
  withTempDir((tempDir) => {
    const sourceLibraryPath = path.join(tempDir, "source_library.csv");
    const existingManifestPath = path.join(tempDir, "archive_manifest.csv");
    const outputPath = path.join(tempDir, "generated_manifest.csv");
    const manifestSourceIds = ["S-0006", "S-0105", "S-0106"];
    const configPath = buildConfig(tempDir, manifestSourceIds);

    writeFile(
      sourceLibraryPath,
      [
        "source_id,title,publisher,pub_date,url,archive_url,access_date,source_type,reliability_tier,audit_sections,question_ids,key_data_extracted,limitations,file_path,sha256,notes",
        'S-0006,"P.L. 119-4",Congress,2025-03,"https://www.congress.gov/bill/119th-congress/house-bill/1968 (H.R. 1968 / P.L. 119-4 bill record)",PENDING,2026-07-04,appropriation_act,A,3,Q-001,"bill record",,,"","annotated bill URL"',
        'S-0105,"VA OIG 24-03692-76",VA OIG,2025-03,"https://www.vaoig.gov/sites/default/files/reports/2025-03/vaoig-24-03692-76_final_redacted.pdf (report PDF)",PENDING,2026-07-04,oig_report,A,3,Q-007,"report PDF",,,"","annotated pdf URL"',
        'S-0106,"VA OIG 24-03127-66",VA OIG,2025-03,"https://www.vaoig.gov/sites/default/files/reports/2025-05/vaoig-24-03127-66-final-locked.pdf direct PDF",PENDING,2026-07-04,oig_report,A,3,Q-008,"report PDF",,,"","descriptive annotation"'
      ].join("\n")
    );

    writeFile(
      existingManifestPath,
      [
        "source_id,canonical_url,save_page_now_url,capture_url_recorded,sha256_recorded,archive_status,archive_date,verified_by,archive_failure_date,archive_failure_reason,archive_attempted_url",
        "S-0006,https://old.example/s-0006,https://web.archive.org/save/https://old.example/s-0006,,,ATTEMPT_FAILED,,CAL,2026-07-04,Job failed,https://web.archive.org/save/https://old.example/s-0006",
        "S-0105,https://old.example/s-0105,https://web.archive.org/save/https://old.example/s-0105,,,NEEDS_RECAPTURE,2026-07-03,CAL,,,",
        "S-0106,https://old.example/s-0106,https://web.archive.org/save/https://old.example/s-0106,https://web.archive.org/web/20260704104245/https://www.vaoig.gov/sites/default/files/reports/2025-05/vaoig-24-03127-66-final-locked.pdf,0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef,ARCHIVED,2026-07-04,CAL,,,"
      ].join("\n")
    );

    const result = generateArchiveManifest({
      sourceLibraryPath,
      existingManifestPath,
      outputPath,
      configPath
    });

    const byId = new Map(result.records.map((record) => [record.source_id, record]));

    assert.equal(
      byId.get("S-0006").canonical_url,
      "https://www.congress.gov/bill/119th-congress/house-bill/1968"
    );
    assert.equal(
      byId.get("S-0105").canonical_url,
      "https://www.vaoig.gov/sites/default/files/reports/2025-03/vaoig-24-03692-76_final_redacted.pdf"
    );
    assert.equal(
      byId.get("S-0106").canonical_url,
      "https://www.vaoig.gov/sites/default/files/reports/2025-05/vaoig-24-03127-66-final-locked.pdf"
    );
    assert.equal(byId.get("S-0006").archive_status, "ATTEMPT_FAILED");
    assert.equal(byId.get("S-0105").archive_status, "NEEDS_RECAPTURE");
    assert.equal(byId.get("S-0106").archive_status, "ARCHIVED");
    assert.equal(byId.get("S-0106").verified_by, "CAL");
  }));

test("mergeArchiveManifest preserves authoritative evidence and applies corrected canonical URLs", () =>
  withTempDir((tempDir) => {
    const authoritativeManifestPath = path.join(tempDir, "archive_manifest_authoritative.csv");
    const correctionTemplatePath = path.join(tempDir, "correction-template.csv");
    const outputPath = path.join(tempDir, "merged_manifest.csv");
    const manifestSourceIds = ["S-0006", "S-0024", "S-0105", "S-0106", "S-0116"];
    const configPath = buildConfig(tempDir, manifestSourceIds);

    writeFile(
      authoritativeManifestPath,
      [
        "source_id,canonical_url,save_page_now_url,capture_url_recorded,sha256_recorded,archive_status,archive_date,verified_by,archive_failure_date,archive_failure_reason,archive_attempted_url,notes",
        "S-0006,https://www.congress.gov,https://web.archive.org/save/https://www.congress.gov,,,NEEDS_RECAPTURE,2026-07-02,CAL,,,,bill record requires recapture",
        "S-0024,https://www.vaoig.gov/reports,https://web.archive.org/save/https://www.vaoig.gov/reports,,,ATTEMPT_FAILED,,CAL,2026-07-03,Job failed,https://web.archive.org/save/https://www.vaoig.gov/reports,Save Page Now failed",
        "S-0105,https://www.vaoig.gov,https://web.archive.org/save/https://www.vaoig.gov,,,NEEDS_RECAPTURE,2026-07-02,CAL,,,,report PDF requires recapture",
        "S-0106,https://www.vaoig.gov,https://web.archive.org/save/https://www.vaoig.gov,,,NEEDS_RECAPTURE,2026-07-02,CAL,,,,report PDF requires recapture",
        "S-0116,https://www.gao.gov/products/gao-23-105290,https://web.archive.org/save/https://www.gao.gov/products/gao-23-105290,https://web.archive.org/web/20260704150000/https://www.gao.gov/products/gao-23-105290,aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,ARCHIVED,2026-07-04,CAL,,,,validated archive"
      ].join("\n")
    );

    writeFile(
      correctionTemplatePath,
      [
        "source_id,canonical_url,save_page_now_url,capture_url_recorded,sha256_recorded,archive_status,archive_date,verified_by,archive_failure_date,archive_failure_reason,archive_attempted_url",
        "S-0006,https://www.congress.gov/bill/119th-congress/house-bill/1968,https://web.archive.org/save/https://www.congress.gov/bill/119th-congress/house-bill/1968,,,PENDING,,,,,",
        "S-0024,https://www.vaoig.gov/reports,https://web.archive.org/save/https://www.vaoig.gov/reports,,,PENDING,,,,,",
        "S-0105,https://www.vaoig.gov/sites/default/files/reports/2025-03/vaoig-24-03692-76_final_redacted.pdf,https://web.archive.org/save/https://www.vaoig.gov/sites/default/files/reports/2025-03/vaoig-24-03692-76_final_redacted.pdf,,,PENDING,,,,,",
        "S-0106,https://www.vaoig.gov/sites/default/files/reports/2025-05/vaoig-24-03127-66-final-locked.pdf,https://web.archive.org/save/https://www.vaoig.gov/sites/default/files/reports/2025-05/vaoig-24-03127-66-final-locked.pdf,,,PENDING,,,,,",
        "S-0116,https://www.gao.gov/products/gao-23-105290,https://web.archive.org/save/https://www.gao.gov/products/gao-23-105290,,,PENDING,,,,,"
      ].join("\n")
    );

    const result = mergeArchiveManifest({
      authoritativeManifestPath,
      correctionManifestPath: correctionTemplatePath,
      outputPath,
      configPath
    });

    const byId = new Map(result.records.map((record) => [record.source_id, record]));

    assert.equal(
      byId.get("S-0006").canonical_url,
      "https://www.congress.gov/bill/119th-congress/house-bill/1968"
    );
    assert.equal(
      byId.get("S-0105").canonical_url,
      "https://www.vaoig.gov/sites/default/files/reports/2025-03/vaoig-24-03692-76_final_redacted.pdf"
    );
    assert.equal(
      byId.get("S-0106").canonical_url,
      "https://www.vaoig.gov/sites/default/files/reports/2025-05/vaoig-24-03127-66-final-locked.pdf"
    );
    assert.equal(byId.get("S-0024").archive_status, "ATTEMPT_FAILED");
    assert.equal(byId.get("S-0024").archive_failure_reason, "Job failed");
    assert.equal(byId.get("S-0024").archive_attempted_url, "https://web.archive.org/save/https://www.vaoig.gov/reports");
    assert.equal(byId.get("S-0116").archive_status, "ARCHIVED");
    assert.equal(byId.get("S-0116").capture_url_recorded, "https://web.archive.org/web/20260704150000/https://www.gao.gov/products/gao-23-105290");
    assert.equal(byId.get("S-0116").sha256_recorded, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    assert.equal(byId.get("S-0116").verified_by, "CAL");
    assert.equal(byId.get("S-0116").notes, "validated archive");
    assert.equal(result.report.rowsPreserved, 5);
    assert.equal(result.report.canonicalUrlsChanged, 3);
    assert.equal(result.report.rowsDowngradedToNeedsRecapture, 0);
    assert.ok(result.report.attemptedUnsafeOverwritesBlocked >= 1);

    const statuses = countManifestStatuses(result.records);
    assert.deepEqual(statuses, {
      ARCHIVED: 1,
      ATTEMPT_FAILED: 1,
      NEEDS_RECAPTURE: 3
    });
  }));

test("mergeArchiveManifest preserves a 43-row authoritative state with 38 ARCHIVED, 4 NEEDS_RECAPTURE, and 1 ATTEMPT_FAILED", () =>
  withTempDir((tempDir) => {
    const authoritativeManifestPath = path.join(tempDir, "archive_manifest_authoritative.csv");
    const correctionTemplatePath = path.join(tempDir, "correction-template.csv");
    const outputPath = path.join(tempDir, "merged_manifest.csv");
    const manifestSourceIds = [
      "S-0001",
      "S-0002",
      "S-0003",
      "S-0004",
      "S-0005",
      "S-0006",
      "S-0007",
      "S-0008",
      "S-0009",
      "S-0010",
      "S-0011",
      "S-0012",
      "S-0013",
      "S-0014",
      "S-0015",
      "S-0016",
      "S-0017",
      "S-0020",
      "S-0021",
      "S-0022",
      "S-0023",
      "S-0024",
      "S-0025",
      "S-0026",
      "S-0027",
      "S-0028",
      "S-0029",
      "S-0030",
      "S-0101",
      "S-0102",
      "S-0103",
      "S-0104",
      "S-0105",
      "S-0106",
      "S-0107",
      "S-0108",
      "S-0109",
      "S-0111",
      "S-0112",
      "S-0113",
      "S-0114",
      "S-0115",
      "S-0116"
    ];
    const configPath = buildConfig(tempDir, manifestSourceIds);

    const correctionRows = [
      "source_id,canonical_url,save_page_now_url,capture_url_recorded,sha256_recorded,archive_status,archive_date,verified_by,archive_failure_date,archive_failure_reason,archive_attempted_url,notes"
    ];
    const authoritativeRows = [
      "source_id,canonical_url,save_page_now_url,capture_url_recorded,sha256_recorded,archive_status,archive_date,verified_by,archive_failure_date,archive_failure_reason,archive_attempted_url,notes"
    ];

    for (const [index, sourceId] of manifestSourceIds.entries()) {
      const baseCanonical = `https://example.com/${sourceId.toLowerCase()}.pdf`;
      const correctedCanonical =
        sourceId === "S-0006"
          ? "https://www.congress.gov/bill/119th-congress/house-bill/1968"
          : sourceId === "S-0105"
            ? "https://www.vaoig.gov/sites/default/files/reports/2025-03/vaoig-24-03692-76_final_redacted.pdf"
            : sourceId === "S-0106"
              ? "https://www.vaoig.gov/sites/default/files/reports/2025-05/vaoig-24-03127-66-final-locked.pdf"
              : sourceId === "S-0024"
                ? "https://www.vaoig.gov/reports"
                : baseCanonical;
      const authoritativeCanonical =
        sourceId === "S-0006" || sourceId === "S-0105" || sourceId === "S-0106"
          ? sourceId === "S-0006"
            ? "https://www.congress.gov"
            : "https://www.vaoig.gov"
          : correctedCanonical;
      const status =
        sourceId === "S-0024"
          ? "ATTEMPT_FAILED"
          : sourceId === "S-0005" || sourceId === "S-0006" || sourceId === "S-0105" || sourceId === "S-0106"
            ? "NEEDS_RECAPTURE"
            : "ARCHIVED";
      const hash = `${index.toString(16).padStart(2, "0").repeat(32)}`;
      const captureUrl = `https://web.archive.org/web/20260704120000/${correctedCanonical}`;

      correctionRows.push(
        [
          sourceId,
          correctedCanonical,
          `https://web.archive.org/save/${correctedCanonical}`,
          "",
          "",
          "PENDING",
          "",
          "",
          "",
          "",
          "",
          ""
        ].join(",")
      );

      authoritativeRows.push(
        [
          sourceId,
          authoritativeCanonical,
          `https://web.archive.org/save/${authoritativeCanonical}`,
          status === "ARCHIVED" ? captureUrl : "",
          status === "ARCHIVED" ? hash : "",
          status,
          status === "ARCHIVED" || status === "NEEDS_RECAPTURE" ? "2026-07-04" : "",
          "CAL",
          status === "ATTEMPT_FAILED" ? "2026-07-04" : "",
          status === "ATTEMPT_FAILED" ? "Job failed" : "",
          status === "ATTEMPT_FAILED" ? `https://web.archive.org/save/${authoritativeCanonical}` : "",
          status === "ATTEMPT_FAILED" ? "Save Page Now failed" : status === "ARCHIVED" ? "Validated archive" : "Needs recapture"
        ].join(",")
      );
    }

    writeFile(authoritativeManifestPath, authoritativeRows.join("\n"));
    writeFile(correctionTemplatePath, correctionRows.join("\n"));

    const result = mergeArchiveManifest({
      authoritativeManifestPath,
      correctionManifestPath: correctionTemplatePath,
      outputPath,
      configPath
    });

    const statuses = countManifestStatuses(result.records);
    const byId = new Map(result.records.map((record) => [record.source_id, record]));

    assert.deepEqual(statuses, {
      ARCHIVED: 38,
      ATTEMPT_FAILED: 1,
      NEEDS_RECAPTURE: 4
    });
    assert.equal(
      byId.get("S-0006").canonical_url,
      "https://www.congress.gov/bill/119th-congress/house-bill/1968"
    );
    assert.equal(
      byId.get("S-0105").canonical_url,
      "https://www.vaoig.gov/sites/default/files/reports/2025-03/vaoig-24-03692-76_final_redacted.pdf"
    );
    assert.equal(
      byId.get("S-0106").canonical_url,
      "https://www.vaoig.gov/sites/default/files/reports/2025-05/vaoig-24-03127-66-final-locked.pdf"
    );
    assert.equal(byId.get("S-0006").archive_status, "NEEDS_RECAPTURE");
    assert.equal(byId.get("S-0105").archive_status, "NEEDS_RECAPTURE");
    assert.equal(byId.get("S-0106").archive_status, "NEEDS_RECAPTURE");
    assert.equal(byId.get("S-0024").archive_status, "ATTEMPT_FAILED");
    assert.equal(byId.get("S-0024").archive_failure_reason, "Job failed");
    assert.equal(result.report.rowsPreserved, 43);
    assert.equal(result.report.canonicalUrlsChanged, 3);
    assert.equal(result.report.rowsDowngradedToNeedsRecapture, 0);
  }));

test("mergeArchiveManifest downgrades archived rows when the corrected canonical URL no longer matches preserved archive evidence", () =>
  withTempDir((tempDir) => {
    const authoritativeManifestPath = path.join(tempDir, "archive_manifest_authoritative.csv");
    const correctionTemplatePath = path.join(tempDir, "correction-template.csv");
    const outputPath = path.join(tempDir, "merged_manifest.csv");
    const manifestSourceIds = ["S-0105"];
    const configPath = buildConfig(tempDir, manifestSourceIds);

    writeFile(
      authoritativeManifestPath,
      [
        "source_id,canonical_url,save_page_now_url,capture_url_recorded,sha256_recorded,archive_status,archive_date,verified_by",
        "S-0105,https://www.vaoig.gov,https://web.archive.org/save/https://www.vaoig.gov,https://web.archive.org/web/20260704104500/https://www.vaoig.gov,bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb,ARCHIVED,2026-07-04,CAL"
      ].join("\n")
    );

    writeFile(
      correctionTemplatePath,
      [
        "source_id,canonical_url,save_page_now_url,capture_url_recorded,sha256_recorded,archive_status,archive_date,verified_by",
        "S-0105,https://www.vaoig.gov/sites/default/files/reports/2025-03/vaoig-24-03692-76_final_redacted.pdf,https://web.archive.org/save/https://www.vaoig.gov/sites/default/files/reports/2025-03/vaoig-24-03692-76_final_redacted.pdf,,,,,"
      ].join("\n")
    );

    const result = mergeArchiveManifest({
      authoritativeManifestPath,
      correctionManifestPath: correctionTemplatePath,
      outputPath,
      configPath
    });

    assert.equal(result.records[0].archive_status, "NEEDS_RECAPTURE");
    assert.equal(result.report.rowsDowngradedToNeedsRecapture, 1);
    assert.equal(result.records[0].capture_url_recorded, "https://web.archive.org/web/20260704104500/https://www.vaoig.gov");
    assert.equal(result.records[0].sha256_recorded, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
  }));

test("validateManifestPreservation rejects erased authoritative archive evidence", () => {
  assert.throws(
    () =>
      validateManifestPreservation(
        [
          {
            source_id: "S-0024",
            canonical_url: "https://www.vaoig.gov/reports",
            archive_status: "PENDING",
            archive_failure_reason: "",
            archive_attempted_url: ""
          }
        ],
        [
          {
            source_id: "S-0024",
            canonical_url: "https://www.vaoig.gov/reports",
            archive_status: "ATTEMPT_FAILED",
            archive_failure_reason: "Job failed",
            archive_attempted_url: "https://web.archive.org/save/https://www.vaoig.gov/reports"
          }
        ]
      ),
    /ATTEMPT_FAILED status must be preserved|authoritative archive_failure_reason would be erased/
  );
});

test("validateManifestRows rejects duplicate canonical URLs and duplicate SHA-256 hashes unless whitelisted", () => {
  assert.throws(
    () =>
      validateManifestRows(
        [
          {
            source_id: "S-0001",
            canonical_url: "https://example.com/report-a.pdf",
            sha256_recorded: ""
          },
          {
            source_id: "S-0002",
            canonical_url: "https://example.com/report-a.pdf",
            sha256_recorded: ""
          }
        ],
        {
          duplicateCanonicalUrlWhitelist: [],
          duplicateSha256Whitelist: []
        }
      ),
    /Duplicate canonical URL detected/
  );

  assert.throws(
    () =>
      validateManifestRows(
        [
          {
            source_id: "S-0003",
            canonical_url: "https://example.com/report-b.pdf",
            sha256_recorded: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
          },
          {
            source_id: "S-0004",
            canonical_url: "https://example.com/report-c.pdf",
            sha256_recorded: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
          }
        ],
        {
          duplicateCanonicalUrlWhitelist: [],
          duplicateSha256Whitelist: []
        }
      ),
    /Duplicate SHA-256 detected/
  );

  assert.doesNotThrow(() =>
    validateManifestRows(
      [
        {
          source_id: "S-0005",
          canonical_url: "https://example.com/report-d.pdf",
          sha256_recorded: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        },
        {
          source_id: "S-0006",
          canonical_url: "https://example.com/report-e.pdf",
          sha256_recorded: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        }
      ],
      {
        duplicateCanonicalUrlWhitelist: [],
        duplicateSha256Whitelist: [
          {
            value: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            sourceIds: ["S-0005", "S-0006"],
            reason: "Documented duplicate retained intentionally for a controlled test case."
          }
        ]
      }
    )
  );
});
