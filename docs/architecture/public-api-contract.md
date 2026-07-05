# ADS Public API Contract

Status: planned contract

The ADS public API is the machine-readable publication surface for The Citizen Audit.

## Purpose

The API must allow researchers, journalists, citizens, reviewers, and future tools to inspect audit records without scraping HTML.

## Required endpoints

```text
/api/index.json
/api/audits.json
/api/audits/001.json
/api/audits/001/claims.json
/api/audits/001/sources.json
/api/audits/001/decisions.json
/api/audits/001/unknowns.json
```

Future audits follow the same pattern:

```text
/api/audits/{audit-number}.json
/api/audits/{audit-number}/claims.json
/api/audits/{audit-number}/sources.json
/api/audits/{audit-number}/decisions.json
/api/audits/{audit-number}/unknowns.json
```

## Rules

1. API output must be generated from ADS records.
2. API output must not contain conclusions that are absent from ADS records.
3. API output must preserve permanent ADS IDs.
4. API output may include legacy IDs for compatibility.
5. API output must be reproducible from repository data.
6. API output must be included in publication manifests once the builder is active.

## Non-goals

The first API does not need authentication, database storage, user accounts, comments, or dynamic server behavior. Static JSON is sufficient and preferred for reproducibility.

## Implementation target

Add a build step after ADS export and validation:

```text
npm run ads:export
npm run ads:validate
npm run ads:api
npm run build:publication
npm run qa
```

The static site should then publish API JSON under `public/api/`.
