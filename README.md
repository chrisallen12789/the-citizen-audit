# The Citizen Audit

Release-candidate publication platform for The Citizen Audit.

Current public domain: https://thecitizenaudit.org

This repository contains the generated public publication, evidence platform, source library, claim records, decision log, open-question register, release artifacts, and Cloudflare deployment code for The Citizen Audit.

Deployment uses Cloudflare Wrangler static assets. Website files live under `public/`.

## Platform v2 institutional foundation

Platform v2 is being developed around the Audit Definition Specification (ADS) so future audits can be represented as structured records instead of handcrafted pages.

Core ADS locations:

- `docs/architecture/ads-v1.md` — institutional data specification.
- `schemas/ads/v1/` — JSON schemas for audit, claim, source, decision, unknown, and registry records.
- `registry/audits.json` — canonical audit registry.
- `audits/001/` and `audits/002/` — initial ADS audit records and record-set placeholders.

## Local workflow

1. Run `npm install`
2. Run `npm run ads:validate`
3. Run `npm run build:publication`
4. Run `npm run qa`
5. Run `npm run release:rc`

## Deployment

The production deploy command is `npm run deploy`.

Wrangler requires a `CLOUDFLARE_API_TOKEN` in non-interactive environments. Without that token, deployment verification can only confirm the live site state, not publish a new build.

Status: `v1.0.0-rc1` release-candidate generation is supported on the current branch. Citation verification is complete and frozen unless QA uncovers an objective error.
