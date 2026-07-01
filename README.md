# The Citizen Audit

Public research site for The Citizen Audit.

Current public domain: https://thecitizenaudit.org

This repository contains the website code, audit reader pages, source index, downloads page, methodology page, press page, corrections page, and explorer prototype.

Deployment uses Cloudflare Wrangler static assets. Website files live under `public/`.

## Local workflow

1. Run `npm install`
2. Run `npm run build:publication`
3. Run `npm run qa`

## Deployment

The production deploy command is `npm run deploy`.

Wrangler requires a `CLOUDFLARE_API_TOKEN` in non-interactive environments. Without that token, deployment verification can only confirm the live site state, not publish a new build.

Status: semantic section conversion, structured source records, structured decision records, publication search, and verification-layer pages are in progress on the current branch.
