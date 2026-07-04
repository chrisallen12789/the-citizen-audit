# Archive Workflow

## Step 1
Start the supported local Archive Assistant stack:

```bash
npm run archive:assistant
```

This starts:

- the local Archive Assistant helper on `http://127.0.0.1:4317`
- the local Archive Assistant page server on `http://127.0.0.1:4175/archive-assistant.html`

If you need to start them separately instead, use:

```bash
npm run archive:helper
npm run archive:serve
```

The helper gives the Archive Assistant a local fallback for:

- Wayback snapshot lookup
- archive URL verification
- SHA-256 generation when the browser is blocked by CORS

## Step 2
Open [http://127.0.0.1:4175/archive-assistant.html](http://127.0.0.1:4175/archive-assistant.html).

- Load the bundled manifest or upload `archive_manifest.csv`.
- The assistant auto-saves progress locally.
- Work through the `Pending` queue first.

## Step 3
Complete archive URLs manually.

- Open the canonical URL.
- Open the Save Page Now URL.
- If Save Page Now succeeds, paste the returned archive URL.
- If Save Page Now fails, use `Check Existing Archives` and select a real Wayback snapshot if one exists.
- If no snapshot exists, record `Archive Attempt Failed` and move on.

The assistant will:

- auto-fill capture date from the Wayback timestamp when possible
- fall back to today only when no Wayback timestamp is available
- auto-attempt SHA-256 generation
- auto-advance when a row reaches valid `ARCHIVED` completion

## Step 4
Use the `Retry` queue later.

- Switch to `Show Retry` after the straightforward rows are finished.
- Revisit failed attempts and try Save Page Now again.

## Step 5
Run batch hashing if needed:

```bash
npm run archive:hash
```

This fills missing `sha256_recorded` values only for rows that already have a real `capture_url_recorded`.

It does not invent archive URLs, dates, statuses, or verifier names.

## Step 6
Reload the manifest.

- If you loaded the bundled manifest, use `Reload manifest`.
- If you loaded a file manually from disk, load it again from disk.

## Step 7
Perform Final Export.

- Normal `Export completed CSV` is always available for working saves.
- `Export Final Manifest` runs the full Source Gate consistency check.
- On success it exports:
  - `archive_manifest.csv`
  - `archive_manifest.sha256.txt`

## Step 8
Save the completed manifest and the manifest hash sidecar file.

The sidecar format is:

```text
<sha256>  archive_manifest.csv
```

## Step 9
Export the audit log if needed.

- Use `Export Audit Log` to download `archive_manifest_audit_log.json`.

## Step 10
Give the completed manifest, manifest hash, and any supporting audit log to Claude for final recalculation.
