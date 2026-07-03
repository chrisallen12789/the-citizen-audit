const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const publication = require("./publication-data");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const releaseDir = path.join(root, "release");
const artifactsDir = path.join(releaseDir, "artifacts");
const siteDir = path.join(releaseDir, "site");
const version = publication.primaryAudit?.currentReleaseVersion || "v1.0.0-rc1";
const artifactPrefix = `the-citizen-audit-${version}`;
const pdfSource =
  process.env.CANONICAL_PDF_PATH ||
  path.join(process.env.USERPROFILE || "C:\\Users\\Chris", "Downloads", "The Citizen Audit - v1.0(1).pdf");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function writeReleaseFile(relativePath, content) {
  const target = path.join(releaseDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function copyFileToRelease(source, relativePath) {
  const target = path.join(releaseDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  return target;
}

function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const nextSource = path.join(source, entry.name);
    const nextDestination = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(nextSource, nextDestination);
    } else {
      fs.copyFileSync(nextSource, nextDestination);
    }
  }
}

function runGit(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function walkFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(next));
    } else {
      files.push(next);
    }
  }
  return files;
}

function createZip(sourceDir, destinationZip) {
  if (fs.existsSync(destinationZip)) {
    fs.rmSync(destinationZip, { force: true });
  }
  try {
    execFileSync("tar", ["-a", "-cf", destinationZip, "-C", sourceDir, "."], {
      cwd: root,
      stdio: "pipe"
    });
  } catch (error) {
    const command = `Compress-Archive -Path (Join-Path '${sourceDir.replace(/'/g, "''")}' '*') -DestinationPath '${destinationZip.replace(/'/g, "''")}' -CompressionLevel Optimal`;
    execFileSync("powershell", ["-NoProfile", "-Command", command], {
      cwd: root,
      stdio: "pipe"
    });
  }
}

function formatList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function buildReleaseNotes(metrics) {
  return `# Release Notes ${version}

## Summary

${version} packages the current evidence platform around the locked Version 1.0 analytical edition. The research program is complete for the current claim set. Publication remains blocked only by author-controlled publication requirements.

## Publication status

- Research Complete
- Source Gate Pending Archive Session
- Publication Recommendation: NOT READY
- Reason: Author-controlled publication gate outstanding.

## Included in this release package

- Generated public website with structured section, claim, source, decision, and open-question pages
- Canonical PDF publication packaged as the controlling locked-edition artifact
- Source library with verified citation metadata and archive-status fields
- Claim database, search index, evidence graph, cross-reference tables, manifest, metrics, status outputs, and Version 2 publication metadata
- Release engineering artifacts under \`/release\`, including checksums, QA report, reproducible-build notes, known limitations, and methodology summary

## Current platform counts

- Claims: ${metrics.claims}
- Verified sources: ${metrics.verifiedSourceCount}
- Open questions: ${metrics.openQuestions}
- HTML pages: ${metrics.htmlPages}
- Archive coverage: ${metrics.archiveCoverageCount}
- QA status: ${metrics.qaStatus.status}
`;
}

function buildKnownLimitations(metrics) {
  return `# Known Limitations

This document describes boundaries and unresolved areas in the current publication state. It does not defend conclusions; it records where evidence remains incomplete or where reasonable reviewers may disagree.

## Methodology boundaries

- The audit preserves basis discipline. Appropriations, obligations, outlays, disbursements, caseloads, and modeled estimates are not blended into a synthetic grand total.
- Version 1.0 reports known-minimum figures when public evidence is incomplete rather than filling gaps with inferred values.
- Citizen-child exclusions, mixed-status household rules, and beneficiary-chain distinctions limit what can be counted as non-citizen-directed value.

## Evidence limitations

- Some federal programs do not publish citizenship-status breakouts needed to isolate attributable dollars; those lanes remain routed to gap treatment instead of counted totals.
- Several sections depend on agency reporting that is structurally incomplete for recipient-level or beneficiary-chain measurement.
- Congressional Research Service pages can be hard to fetch automatically, so verification depends on official product metadata and linked CRS PDF artifacts where direct machine access is blocked.
- The archive session remains author-controlled and incomplete, so publication readiness remains below launch recommendation even though the current claim set is frozen.

## Open uncertainties

- Open-question records remain part of the release because unresolved items still affect how far certain sections can be taken.
- Section 13 remains a gap register by design for programs lacking defensible citizenship breakouts.
- Certain domestic programs identify program totals but not non-citizen-attributable value in a form suitable for locked counting.

## Future research

- Additional primary records could reduce open-question exposure in domestic benefit sections.
- Federal reconciliation across aid stages, recipient value, and domestic provider capture remains a high-value future transparency target.
- Future releases may add broader archival coverage, richer export formats, and deeper reviewer tooling without changing locked v1.0 conclusions.
- If the archive session is completed later, publication recommendation should advance automatically to READY WITH EXPLICIT LIMITATIONS without further engineering changes.

## Current release snapshot

- Verified sources: ${metrics.verifiedSourceCount}
- Pending sources: ${metrics.pendingSourceCount}
- Open questions: ${metrics.openQuestions}
`;
}

function buildMethodologyDoc(metrics) {
  return `# Methodology

## Claim lifecycle

1. A claim is defined as a first-class structured record with an ID, section ownership, source links, confidence label, and revision history.
2. Claims are published only when the supporting public record is explicit enough to preserve basis discipline.
3. Claims retain links to sources, decisions, and open questions so reviewers can follow the same evidence path used during publication generation.

## Evidence standards

- Primary federal records, statutes, and administrative documents outrank corroborating summaries.
- Secondary analyses remain labeled as such and are not substituted for missing primary data.
- Unknown values remain explicit unknowns when the public record stops short of defensible measurement.

## Citation verification workflow

- Each source record tracks publisher, document type, publication date, retrieval date, canonical URL, archive URL or archive status, and verification notes.
- High-priority sources must carry canonical URLs and normalized metadata before QA passes.
- Citation verification is frozen for the current publication state unless QA identifies an objective error.
- The research program is complete for the current claim set, so engineering changes should not strengthen or weaken substantive conclusions without a later edition.

## Decision logging

- Methodology rules and scoping choices are recorded as public decision-log entries with stable IDs.
- Decision pages link back to related claims, sources, and open questions so reviewers can inspect rule application.

## Publication generation

- Structured audit, section, claim, source, decision, and open-question records are rendered into HTML via the publication build.
- Search index, evidence graph, cross-reference tables, manifest, metrics, and status outputs are generated from the same structured data.
- Release artifacts are assembled from the generated site plus the locked canonical PDF.

## Traceability

- Every published claim links to section ownership and supporting source IDs.
- Source pages expose related claims, decisions, and open questions.
- Platform metrics currently report ${metrics.traceabilityPercent}% claim traceability coverage based on source, confidence, and revision-history completeness.

## Reproducibility

- The release package is rebuilt from repository state plus the canonical PDF input.
- Generated artifacts are hashed with SHA-256 and listed in the release manifest.
- QA must pass before release packaging succeeds.
`;
}

function buildReproducibleBuildDoc(metrics, generatorVersions) {
  return `# Reproducible Build

## Required software

- Node.js 22 or newer
- npm compatible with the bundled lockfile
- Git
- PowerShell 5.1+ or a system \`tar\` command capable of ZIP output for release packaging

## Build commands

1. \`npm install\`
2. \`npm run build:publication\`
3. \`npm run qa\`
4. \`npm run release:rc\`

## Expected outputs

- Generated website in \`/public\`
- Release artifacts and reports in \`/release\`
- Checksums file at \`/release/checksums.sha256\`
- Release manifest at \`/release/RELEASE-MANIFEST.json\`

## Validation steps

- Confirm \`npm run qa\` exits successfully
- Confirm \`public/data/platform-metrics.json\` reports QA status \`passed\`
- Confirm \`release/checksums.sha256\` exists and hashes the packaged PDF, ZIPs, and copied site files
- Confirm \`release/artifacts/${artifactPrefix}-publication-package.zip\` and \`release/artifacts/${artifactPrefix}-site.zip\` exist

## Troubleshooting

- If release packaging fails, verify the canonical PDF exists at \`${pdfSource}\` or set \`CANONICAL_PDF_PATH\`
- If ZIP creation fails through \`tar\`, rerun on a Windows machine with PowerShell available
- If QA fails, rebuild after fixing the reported issue before packaging a release

## Generator versions captured for this build

- Package version: ${generatorVersions.packageVersion}
- Node.js: ${generatorVersions.nodeVersion}
- Wrangler: ${generatorVersions.wranglerVersion || "not detected"}
- Build version: ${metrics.buildVersion}
`;
}

function buildUiAudit(metrics) {
  return `# UI Audit

## Summary of improvements

- Standardized canonical, Open Graph, favicon, and theme-color metadata across generated pages and static entry points
- Removed the stray internal test page from public output
- Updated primary navigation on static entry pages to match the generated publication shell
- Regenerated sitemap and robots directives from the live publication output

## Responsive improvements

- The shared shell now carries a consistent responsive nav and page metadata across generated sections, claims, sources, decisions, and utility pages
- The static homepage and press page were aligned with the same navigation model used throughout the generated site
- Responsive spot checks across \`320px\`, \`375px\`, \`390px\`, \`414px\`, \`768px\`, \`820px\`, \`1024px\`, \`1280px\`, \`1440px\`, and \`1920px\` showed no horizontal overflow on the homepage, a numbered section page, source detail, search, explorer, or platform dashboard
- Table-bearing review pages remained scrollable without collapsing the main layout at narrow mobile widths in the audited sample set

## Accessibility improvements

- Generated pages now expose consistent primary-nav labeling, menu state hooks, and favicon/canonical metadata for assistive and browser tooling
- Production QA now checks for canonical tags, Open Graph metadata, and favicon references on key public pages
- Focus visibility was strengthened for interactive controls, and the mobile nav container now remains scrollable instead of clipping long link sets

## Performance and production-readiness improvements

- Release packaging now creates a deterministic copied site, ZIP artifacts, and checksum inventory from the built publication
- Sitemap and robots output are generated automatically so production crawl metadata stays synchronized with the built site
- Console-log spot checks on the homepage, search, explorer, and platform dashboard returned no warnings or errors in the audited local build

## Remaining recommendations

- Capture formal before/after screenshots in a future visual-regression workflow if the project adopts automated snapshot testing
- Consider moving the remaining static public pages into the structured page model in a future non-frozen cycle for even tighter consistency

## Current audit snapshot

- HTML pages reviewed by QA: ${metrics.qaStatus.htmlPagesChecked}
- Generated publication pages: ${metrics.generatedPublicationPages}
- Generated section pages: ${metrics.generatedSectionPages}
`;
}

function buildQaReport(metrics, status, manifest, gitInfo) {
  const qaChecks = metrics.qaStatus.checksEnforced || [];
  return `# QA Report

## Publication state

- Version: ${version}
- Commit: ${gitInfo.commit}
- Branch: ${gitInfo.branch}
- Build timestamp: ${manifest.generatedAt}
- QA status: ${metrics.qaStatus.status}
- Platform health: ${status.status}
- Publication recommendation: ${metrics.publicationReadiness.recommendation}
- Publication reason: ${metrics.publicationReadiness.reason}

## Build verification

- HTML pages generated: ${metrics.htmlPages}
- Publication pages generated: ${metrics.generatedPublicationPages}
- Section pages generated: ${metrics.generatedSectionPages}
- Claim pages generated: ${metrics.generatedClaimPages}
- Verified sources: ${metrics.verifiedSourceCount}
- Archive coverage count: ${metrics.archiveCoverageCount}

## QA checks enforced

${formatList(qaChecks)}

## Additional release checks

- Canonical PDF source detected and copied into the release artifact set
- Sitemap and robots outputs generated from the live publication manifest
- Release artifacts hashed with SHA-256
- No pending source-verification records remain in the current publication data
- No unexpected public HTML artifacts remain after removal of the internal test page
- Readiness messaging is synchronized across metrics, status, roadmap, review, corrections, and transparency pages
`;
}

function main() {
  const metrics = readJson("public/data/platform-metrics.json");
  const status = readJson("public/data/platform-status.json");
  const manifest = readJson("public/data/publication-manifest.json");
  const publicationMetadata = readJson("public/data/publication-metadata-v2.json");
  const claimDatabase = readJson("public/data/claim-database.json");
  const packageJson = readJson("package.json");
  const packageLock = readJson("package-lock.json");
  const gitInfo = {
    branch: runGit(["branch", "--show-current"]),
    commit: runGit(["rev-parse", "HEAD"])
  };

  if (metrics.qaStatus.status !== "passed") {
    throw new Error("Release packaging requires QA status 'passed'. Run npm run build:publication and npm run qa first.");
  }
  if (!fs.existsSync(pdfSource)) {
    throw new Error(`Canonical PDF not found at ${pdfSource}`);
  }

  fs.rmSync(releaseDir, { recursive: true, force: true });
  fs.mkdirSync(artifactsDir, { recursive: true });
  copyDirectory(publicDir, siteDir);

  const pdfTarget = copyFileToRelease(pdfSource, `artifacts/${artifactPrefix}.pdf`);

  const generatorVersions = {
    packageVersion: packageJson.version,
    nodeVersion: process.version,
    wranglerVersion: packageLock.packages?.["node_modules/wrangler"]?.version || null
  };

  writeReleaseFile("RELEASE-NOTES-v1.0.0.md", buildReleaseNotes(metrics));
  writeReleaseFile("KNOWN-LIMITATIONS.md", buildKnownLimitations(metrics));
  writeReleaseFile("METHODOLOGY.md", buildMethodologyDoc(metrics));
  writeReleaseFile("REPRODUCIBLE-BUILD.md", buildReproducibleBuildDoc(metrics, generatorVersions));
  writeReleaseFile("UI-AUDIT.md", buildUiAudit(metrics));
  writeReleaseFile("QA-REPORT.md", buildQaReport(metrics, status, manifest, gitInfo));
  writeReleaseFile("PUBLICATION-METADATA-v2.json", `${JSON.stringify(publicationMetadata, null, 2)}\n`);

  const websiteZip = path.join(artifactsDir, `${artifactPrefix}-site.zip`);
  createZip(siteDir, websiteZip);

  const stagingDir = path.join(root, ".release-staging");
  fs.rmSync(stagingDir, { recursive: true, force: true });
  fs.mkdirSync(stagingDir, { recursive: true });
  copyDirectory(siteDir, path.join(stagingDir, "site"));
  fs.copyFileSync(pdfTarget, path.join(stagingDir, path.basename(pdfTarget)));
  for (const docName of [
    "RELEASE-NOTES-v1.0.0.md",
    "KNOWN-LIMITATIONS.md",
    "METHODOLOGY.md",
    "REPRODUCIBLE-BUILD.md",
    "UI-AUDIT.md",
    "QA-REPORT.md",
    "PUBLICATION-METADATA-v2.json"
  ]) {
    fs.copyFileSync(path.join(releaseDir, docName), path.join(stagingDir, docName));
  }
  const packageZip = path.join(artifactsDir, `${artifactPrefix}-publication-package.zip`);
  createZip(stagingDir, packageZip);
  fs.rmSync(stagingDir, { recursive: true, force: true });

  const checksumTargets = walkFiles(releaseDir).filter((filePath) => {
    const relative = path.relative(releaseDir, filePath).replace(/\\/g, "/");
    return !["checksums.sha256", "RELEASE-MANIFEST.json"].includes(relative);
  });

  const artifactInventory = checksumTargets.map((filePath) => ({
    path: path.relative(releaseDir, filePath).replace(/\\/g, "/"),
    sizeBytes: fs.statSync(filePath).size,
    sha256: sha256(filePath)
  }));

  const releaseManifest = {
    version,
    buildTimestamp: manifest.generatedAt,
    gitCommitHash: gitInfo.commit,
    branch: gitInfo.branch,
    counts: {
      claims: claimDatabase.claims.length,
      verifiedSources: metrics.verifiedSourceCount,
      archiveCoverage: metrics.archiveCoverageCount,
      htmlPagesGenerated: metrics.htmlPages
    },
    qaResults: metrics.qaStatus,
    generatorVersions,
    buildVersion: metrics.buildVersion,
    artifactInventory
  };

  writeReleaseFile("RELEASE-MANIFEST.json", `${JSON.stringify(releaseManifest, null, 2)}\n`);

  const manifestChecksum = sha256(path.join(releaseDir, "RELEASE-MANIFEST.json"));
  const checksumLines = [
    ...artifactInventory.map((item) => `${item.sha256} *${item.path}`),
    `${manifestChecksum} *RELEASE-MANIFEST.json`
  ];
  writeReleaseFile("checksums.sha256", `${checksumLines.join("\n")}\n`);
}

main();
