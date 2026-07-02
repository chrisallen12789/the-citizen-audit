# The Citizen Audit

Release-candidate publication platform for The Citizen Audit.

Current public domain: https://thecitizenaudit.org

This repository contains the generated public publication, evidence platform, source library, claim records, decision log, open-question register, release artifacts, and Cloudflare deployment code for The Citizen Audit.

Deployment uses Cloudflare Wrangler static assets. Website files live under `public/`.

## Local workflow

1. Run `npm install`
2. Run `npm run build:publication`
3. Run `npm run qa`
4. Run `npm run release:rc`

## Deployment

The production deploy command is `npm run deploy`.

Wrangler requires a `CLOUDFLARE_API_TOKEN` in non-interactive environments. Without that token, deployment verification can only confirm the live site state, not publish a new build.

Status: `v1.0.0-rc1` release-candidate generation is supported on the current branch. Citation verification is complete and frozen unless QA uncovers an objective error.
