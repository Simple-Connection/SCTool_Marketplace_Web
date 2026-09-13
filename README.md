# SCTool Marketplace Web

Human-facing, read-only Marketplace UI and public hosting boundary for the canonical SCTool Registry.

## Authority boundary

```text
Simple-Connection/sctool-registry
  -> signed Registry distribution artifact + handoff evidence
  -> SCTool_Marketplace_Web exact-byte hosting
  -> immutable snapshot
  -> Marketplace presentation
```

This repository owns Marketplace presentation, static-site assembly, GitHub Pages deployment, browser fetch configuration, and public hosting of already-signed Registry distribution bytes.

This repository does not own SCTool package admission, publisher identity, Registry canonical data, Registry schemas, trust policy, root/distribution signing, snapshot generation, or Registry private keys. Signed Registry bytes are never regenerated, normalized, reformatted, or re-signed here.

## Exact Registry handoff

The active hosting handoff is pinned in:

```text
deployment/registry-handoff/lock.json
```

The directory also preserves the exact Registry Actions distribution artifact ZIP and exact producer evidence artifact ZIP. Every Pages deployment verifies their SHA-256 digests, validates producer/run/source/artifact identity, validates the exact three-file set, verifies file SHA-256 and byte sizes, and materializes the signed files byte-for-byte under `_site/registry/`.

The producer artifact retention period does not control Marketplace hosting lifetime because the exact accepted handoff artifacts are preserved in this repository as immutable deployment inputs. They remain non-canonical copies; Registry authority stays in `Simple-Connection/sctool-registry`.

## Current browser endpoint

The browser still reads:

```text
https://simple-connection.github.io/sctool-registry/
```

This is intentional for the first production-cutover checkpoint. The Marketplace Pages deployment now hosts the exact distribution at `/registry/`, but the browser base URL is changed only after CI verifies the public `/registry/` bytes exactly match the accepted Registry handoff.

## Public layout

```text
/
├─ index.html
├─ assets/
└─ registry/
   ├─ trust.json
   ├─ registry-head.json
   └─ snapshots/{revision}.json
```

## Validation

```bash
node --check site/assets/registry-client.js
node --check site/assets/app.js
node scripts/validate-site.mjs
node scripts/validate-registry-hosting.mjs
node --test scripts/test-registry-hosting.mjs
python scripts/verify-registry-handoff.py --lock deployment/registry-handoff/lock.json
node scripts/prepare-pages.mjs --out _site
python scripts/verify-registry-handoff.py --lock deployment/registry-handoff/lock.json --materialize _site/registry
node scripts/validate-registry-hosting.mjs --site-root _site --require-registry
```

## Deployment

`.github/workflows/jekyll.yml` validates the Marketplace, verifies the exact Registry handoff, assembles one Pages artifact, materializes the signed Registry bytes, validates the artifact, deploys it, then fetches the public `/registry/` endpoint and requires byte-for-byte equality before producing deployment evidence.

No Registry signing credentials or Registry signing implementation belong in this repository.
