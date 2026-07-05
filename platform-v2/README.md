# The Citizen Audit Platform v2

This folder is the staged Astro rebuild of The Citizen Audit as a reusable audit platform.

It is intentionally staged under `platform-v2/` instead of replacing the current live static site. The current Cloudflare/public site can continue operating while this platform is reviewed, tested, and promoted later.

## Purpose

The current public site began as a static publication surface. Platform v2 turns the project into a data-driven audit engine:

- each audit is a folder of structured data;
- the site generates pages automatically;
- no audit-specific page templates are required;
- claims link to findings, evidence, sources, archive status, decisions, corrections, and downloads;
- the build should fail if the audit data breaks referential integrity.

## Intended audit folder shape

```text
src/content/audits/<slug>/
  audit.json
  findings.json
  claims.json
  sources.json
  evidence.json
  decisions.json
  corrections.json
  downloads.json
  downloads/
```

## Generated pages

A single dynamic route set should generate:

```text
/audits/
/audits/<slug>/
/audits/<slug>/findings/
/audits/<slug>/findings/<finding>/
/audits/<slug>/claims/
/audits/<slug>/claims/<claim>/
/audits/<slug>/sources/
/audits/<slug>/sources/<source>/
/audits/<slug>/evidence/
/audits/<slug>/decisions/
/audits/<slug>/corrections/
/audits/<slug>/downloads/
```

## Validation gate

The platform is built around a hard validation gate:

1. validate each audit file against schema;
2. enforce source/evidence/finding/claim referential integrity;
3. reject duplicate archive hashes or duplicate canonical URLs among archived sources;
4. warn or fail if a published/validated claim cannot reach an archived source.

This is the software expression of the audit principle: no public claim should be stronger than its source trail.

## Local workflow

```bash
cd platform-v2
npm install
npm run validate
npm run build
npm run dev
```

## Integration status

This directory is staged from the Claude-generated Astro platform package and should be treated as Platform v2 candidate code. It should not be deployed over the current site until:

- all source files are committed under this folder;
- the VA audit seed data is confirmed against the uploaded publication package;
- Cloudflare deployment mode is chosen;
- existing public static URLs are either preserved or redirected.
