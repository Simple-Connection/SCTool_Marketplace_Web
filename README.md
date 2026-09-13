# SCTool Marketplace Web

Human-facing, read-only Marketplace UI and sole public GitHub Pages hosting boundary for the canonical SCTool Registry distribution.

## Authority boundary

```text
Simple-Connection/sctool-registry
  -> canonical Registry data, schema, trust and signing
  -> exact signed distribution artifact + handoff evidence
  -> SCTool_Marketplace_Web exact-byte public hosting
  -> Marketplace browser consumption and presentation
```

This repository owns Marketplace presentation, static-site assembly, GitHub Pages deployment, browser fetch configuration, and public hosting of already-signed Registry distribution bytes.

This repository does not own SCTool package admission, publisher identity, Registry canonical data, Registry schemas, trust policy, root/distribution signing, snapshot generation, or Registry private keys. Signed Registry bytes are never regenerated, normalized, reformatted, or re-signed here.

## Exact Registry handoff

The active hosting handoff is pinned in:

```text
deployment/registry-handoff/lock.json
```

The directory preserves the exact Registry Actions distribution artifact ZIP and exact producer evidence artifact ZIP. Every Pages deployment verifies their SHA-256 digests, validates producer/run/source/artifact identity, validates the exact three-file set, verifies file SHA-256 and byte sizes, and materializes the signed files byte-for-byte under `_site/registry/`.

The producer artifact retention period does not control Marketplace hosting lifetime because the exact accepted handoff artifacts are preserved in this repository as immutable deployment inputs. They remain non-canonical copies; Registry authority stays in `Simple-Connection/sctool-registry`.

## Production browser endpoint

The browser now consumes the Registry distribution from the same Marketplace Pages deployment:

```text
https://simple-connection.github.io/SCTool_Marketplace_Web/registry/
```

The source code resolves this as `../registry/` relative to `site/assets/registry-client.js`, so the GitHub Pages project path is not hardcoded.

The cutover was activated only after workflow run `34757627710` verified that the public `/registry/` files were byte-for-byte identical to Registry handoff artifact `10317154228`. The legacy Registry Pages workflow has not been removed or disabled.

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

## Browser trust-chain status

The browser consumer validates the head structure, safe snapshot path, snapshot byte size, snapshot SHA-256, and revision/sequence/source identity. It does not currently perform Ed25519 root-signature or distribution-signature verification in the browser. Those signatures are verified by the Registry producer before handoff and recorded as PASS in the accepted producer evidence. Additional browser trust-chain verification requires a separately approved consumer-side verification contract; Registry signing authority must not be duplicated here.
