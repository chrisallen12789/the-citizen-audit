# Platform validation fixtures

The automated tests synthesize complete temporary record graphs from `tests/helpers/platform-fixtures.js` so each test can safely mutate one invariant without changing canonical records.

- `valid/` is reserved for stable hand-authored examples.
- `invalid/` is reserved for documented rejection examples.

Files in this directory are test inputs only and must never be published as canonical audit records.
