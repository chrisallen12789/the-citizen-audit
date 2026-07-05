# The Citizen Audit

Release-candidate publication platform for The Citizen Audit.

Current public domain: https://thecitizenaudit.org

This repository contains the generated public publication, evidence platform, source library, claim records, decision log, open-question register, release artifacts, and Cloudflare deployment code for The Citizen Audit.

Deployment uses Cloudflare Wrangler static assets. Website files live under `public/`.

## Platform v2 institutional foundation

Platform v2 is being developed around the Audit Definition Specification (ADS) so future audits can be represented as structured records instead of handcrafted pages.

The current publication platform already includes a structured `data-model`, relationship enrichment, evidence graph generation, search output generation, trace records, and detail renderers. ADS v1 therefore works as an institutional compatibility layer over the existing platform rather than as a rewrite.

Core ADS locations:

- `docs/architecture/ads-v1.md` — institutional data specification.
- `docs/architecture/ads-legacy-compatibility.md` — mapping between existing publication IDs and ADS permanent IDs.
- `schemas/ads/v1/` — JSON schemas for audit, claim, source, decision, unknown, and registry records.
- `scripts/export-ads.js` — exports ADS records from the existing `data-model`.
- `scripts/validate-ads.js` — validates ADS schema presence, registry shape, audit records, and referenced record sets.
- `registry/audits.json` — canonical ADS audit registry.
- `audits/001/` — ADS export target for Audit 001.

## Local workflow

1. Run `npm install`
2. Run `npm run ads:sync`
3. Run `npm run build:publication`
4. Run `npm run qa`
5. Run `npm run release:rc`

ADS-only commands:

- `npm run ads:export`
- `npm run ads:validate`
- `npm run ads:sync`

## Deployment

The production deploy command is `npm run deploy`.

Wrangler requires a `CLOUDFLARE_API_TOKEN` in non-interactive environments. Without that token, deployment verification can only confirm the live site state, not publish a new build.

Status: `v1.0.0-rc1` release-candidate generation is supported on the current branch. Citation verification is complete and frozen unless QA uncovers an objective error.
