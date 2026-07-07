#!/usr/bin/env bash
set -euo pipefail

EXPECTED_HEAD="abfc0550be9e448dc7973bff286622c58a07fadc"
TARGET_BRANCH="execution-engine-v2-phase-4-corrected-review"

# The contents-API transfer inserted one verified byte in part-13. Refuse any
# other input, remove only that exact byte sequence, and then verify the intended
# chunk hash before reconstructing the archive.
echo "888ded233b8a43328c998fd12b036638c7156f8203ff85ff39f0cabb0987ce35  .phase41-transfer/part-13" | sha256sum --check --strict
python3 - <<'PY'
from pathlib import Path
path = Path('.phase41-transfer/part-13')
data = path.read_text(encoding='ascii')
bad = 'RJOqCazadaqUw'
good = 'RJOqCzadaqUw'
if data.count(bad) != 1 or good in data:
    raise SystemExit('part-13 does not contain the one authorized transfer corruption')
path.write_text(data.replace(bad, good), encoding='ascii')
PY

sha256sum --check --strict <<'CHUNKS'
b1b29586b392dfcad533f2765988174d0d7466ccf6f32f0266c39cbef858b664  .phase41-transfer/part-00
3199a5f64e684b71d967783911506bfec6ab45c6e5dcc6736849ae14fe5f40c5  .phase41-transfer/part-01
be6afccd75dc4867e4aed11950a51d0e3f485b49ea54add876f46e4a256bee6e  .phase41-transfer/part-02
6becfc9b5065cdfc64e56b6da2d97e4c9787895a5b48fe5eef5fa5ff9bc7f07b  .phase41-transfer/part-03
6bd8d3e37c6f10660cf9ee630ba8777da693a5c864ee345897083fef19fc0781  .phase41-transfer/part-04
deb168c1d837658f0bff2303d83ca7472a8505d7be1248bff20deac8258f0f57  .phase41-transfer/part-05
2a45200d66882f724205a9720bb63a67dc63ad7d215469a50a3f092bd3863dfd  .phase41-transfer/part-06
bb03fb4f8056606951aee5954780feb5dd876bff03a99a39509ada5c1b61e5ac  .phase41-transfer/part-07
269f8d412bf44c662ec123c61a3d454bbff5c2da9b5d3bb746a98c0e99783e50  .phase41-transfer/part-08
c65479c4a5ad818e29b3bbeeb4b4aef1ed74da9f3fc0c3e12bfe0273bd9fdeb5  .phase41-transfer/part-09
4df4abcb29fd253c653716b027451e74e02d8fba054009e6c776b2f3a6fa71fb  .phase41-transfer/part-10
a6795949525ae8fca2b0aff5a130ed715c04ad9f2b9f69ef604a47c2cd7572c6  .phase41-transfer/part-11
227572e2b9488b143421348167ebb9ad0e45423bd285634971cecdac4f62adf5  .phase41-transfer/part-12
421901c5c68184def0c522ad2784094aac6d115a46295cf912127f1a716cc9a5  .phase41-transfer/part-13
df8ff9dbcd5fe2fc35e0ce8fd490b1de06e7e8d0d620d5b557f442b9892e7567  .phase41-transfer/part-14
0c56c0106954aedc95d3b993c2d82153bfcb5f45bde7e53939ea975af31c6e01  .phase41-transfer/part-15
CHUNKS

cat \
  .phase41-transfer/part-00 .phase41-transfer/part-01 \
  .phase41-transfer/part-02 .phase41-transfer/part-03 \
  .phase41-transfer/part-04 .phase41-transfer/part-05 \
  .phase41-transfer/part-06 .phase41-transfer/part-07 \
  .phase41-transfer/part-08 .phase41-transfer/part-09 \
  .phase41-transfer/part-10 .phase41-transfer/part-11 \
  .phase41-transfer/part-12 .phase41-transfer/part-13 \
  .phase41-transfer/part-14 .phase41-transfer/part-15 \
  | base64 --decode > /tmp/phase41-patches.tar.gz

echo "4546b4ecaa64dd7b0734972b959af7217911e0c609e0c4e6e2e62874b9bde977  /tmp/phase41-patches.tar.gz" | sha256sum --check --strict
rm -rf /tmp/phase41-patches
tar -xzf /tmp/phase41-patches.tar.gz -C /tmp

echo "4aadf8eddf8f9a4714e6bdda8173de664bc73c761bb0f5cce74c4b63a11ae26e  /tmp/phase41-patches/0001-Phase-4.1-bind-approvals-runtime-identity-and-recove.patch" | sha256sum --check --strict
echo "5592162d31841b4b91a0150e90f863daa22557e2cff1a8f5a99f883d675dd710  /tmp/phase41-patches/0002-Phase-4.1-enforce-AST-transitive-capability-ownershi.patch" | sha256sum --check --strict
echo "6dd48781e3b9af595ee9ef6697bc699fae3d7ca433e7db74a993a22f34e24bb7  /tmp/phase41-patches/0003-Document-Phase-4.1-corrections-and-verification-gate.patch" | sha256sum --check --strict

# The verified archive is now independent of the tooling worktree. Restore the
# temporary byte repair before changing branches.
git restore .phase41-transfer/part-13

git fetch --quiet --no-tags origin "refs/heads/$TARGET_BRANCH:refs/remotes/origin/$TARGET_BRANCH"
current="$(git rev-parse "origin/$TARGET_BRANCH")"
if [[ "$current" != "$EXPECTED_HEAD" ]]; then
  echo "Target branch changed unexpectedly: expected $EXPECTED_HEAD, found $current" >&2
  exit 1
fi

git checkout --quiet --detach "$EXPECTED_HEAD"
git config user.name "The Citizen Audit Phase 4.1"
git config user.email "phase41@users.noreply.github.com"
git am --quiet \
  /tmp/phase41-patches/0001-Phase-4.1-bind-approvals-runtime-identity-and-recove.patch \
  /tmp/phase41-patches/0002-Phase-4.1-enforce-AST-transitive-capability-ownershi.patch \
  /tmp/phase41-patches/0003-Document-Phase-4.1-corrections-and-verification-gate.patch

if git diff --name-only "$EXPECTED_HEAD"..HEAD | grep -E '^(platform/|schemas/platform-)'; then
  echo "Prohibited public-platform path detected." >&2
  exit 1
fi

git merge-base --is-ancestor "$EXPECTED_HEAD" HEAD
git push --quiet origin "HEAD:refs/heads/$TARGET_BRANCH" \
  --force-with-lease="refs/heads/$TARGET_BRANCH:$EXPECTED_HEAD"
echo "Transferred Phase 4.1 head: $(git rev-parse HEAD)"
