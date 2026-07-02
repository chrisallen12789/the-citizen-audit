# Reproducible Build

## Required software

- Node.js 22 or newer
- npm compatible with the bundled lockfile
- Git
- PowerShell 5.1+ or a system `tar` command capable of ZIP output for release packaging

## Build commands

1. `npm install`
2. `npm run build:publication`
3. `npm run qa`
4. `npm run release:rc`

## Expected outputs

- Generated website in `/public`
- Release artifacts and reports in `/release`
- Checksums file at `/release/checksums.sha256`
- Release manifest at `/release/RELEASE-MANIFEST.json`

## Validation steps

- Confirm `npm run qa` exits successfully
- Confirm `public/data/platform-metrics.json` reports QA status `passed`
- Confirm `release/checksums.sha256` exists and hashes the packaged PDF, ZIPs, and copied site files
- Confirm `release/artifacts/the-citizen-audit-1.0.0-rc1-publication-package.zip` and `release/artifacts/the-citizen-audit-1.0.0-rc1-site.zip` exist

## Troubleshooting

- If release packaging fails, verify the canonical PDF exists at `C:\Users\Chris\Downloads\The Citizen Audit - v1.0(1).pdf` or set `CANONICAL_PDF_PATH`
- If ZIP creation fails through `tar`, rerun on a Windows machine with PowerShell available
- If QA fails, rebuild after fixing the reported issue before packaging a release

## Generator versions captured for this build

- Package version: 1.0.0-rc1
- Node.js: v24.14.0
- Wrangler: 4.106.0
- Build version: 1.0.0-rc1
