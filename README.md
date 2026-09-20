# SCTool Marketplace Web

Human-facing Simple Connection web application, read-only SCTool Marketplace UI, and sole public GitHub Pages hosting boundary for the canonical SCTool Registry distribution.

## Application structure

The site is a static multi-page application with a shared Application Shell.

```text
site/
├─ index.html                                  # Dashboard
├─ marketplace/index.html                     # SCTool Marketplace
├─ application/simple_connection/downloads/   # Simple Connection downloads
├─ settings/
│  ├─ index.html
│  ├─ my-sctool/
│  └─ preferences/
└─ assets/
   ├─ shared/                                  # Header, GNB, LNB, search, account slot
   ├─ dashboard/
   ├─ marketplace/
   ├─ application/simple-connection/
   ├─ settings/
   └─ registry-client.js
```

The Header owns the global Marketplace search and an intentionally unconfigured GitHub account slot. Authentication, OAuth, token storage, and account synchronization are not implemented until a separate authentication contract is approved.

## Authority boundaries

### SCTool Registry

```text
Simple-Connection/sctool-registry
  -> canonical Registry data, schema, trust and signing
  -> exact signed distribution artifact + handoff evidence
  -> SCTool_Marketplace_Web exact-byte public hosting
  -> Marketplace browser consumption and presentation
```

This repository owns Marketplace presentation, static-site assembly, GitHub Pages deployment, browser fetch configuration, and public hosting of already-signed Registry distribution bytes.

This repository does not own SCTool package admission, publisher identity, Registry canonical data, Registry schemas, trust policy, root/distribution signing, snapshot generation, or Registry private keys. Signed Registry bytes are never regenerated, normalized, reformatted, or re-signed here.

### Simple Connection releases

Simple Connection release metadata is owned by Application Worker. The web page consumes:

```text
GET /application/simple_connection/update/desktop/win/x64/releases
```

The response supplies `latestVersion` and ordered `releases`. The website does not hardcode release versions, infer the latest version, or SemVer-sort releases. The Latest download card and the release table are rendered from the same catalog response.

The download UI is published at:

```text
/application/simple_connection/downloads/
```

`site/application/simple_connection/downloads/index.html` exposes an `application-worker-base` meta configuration boundary. When it is empty, the browser uses the current origin. If Application Worker uses another origin, set only that base URL; release/version logic remains unchanged.

Release `downloadUrl` values are resolved against Application Worker and must remain inside the approved `/application/simple_connection/update/desktop/win/x64/releases/` namespace. Catalog inconsistency or network failure is fail-closed; no stale hardcoded download is substituted.

## Exact Registry handoff

The active hosting handoff is pinned in:

```text
deployment/registry-handoff/lock.json
```

The directory preserves the exact Registry Actions distribution artifact ZIP and exact producer evidence artifact ZIP. Every Pages deployment verifies their SHA-256 digests, validates producer/run/source/artifact identity, validates the exact three-file set, verifies file SHA-256 and byte sizes, and materializes the signed files byte-for-byte under `_site/registry/`.

The producer artifact retention period does not control Marketplace hosting lifetime because the exact accepted handoff artifacts are preserved in this repository as immutable deployment inputs. They remain non-canonical copies; Registry authority stays in `Simple-Connection/sctool-registry`.

## Production browser Registry endpoint

The browser consumes the Registry distribution from the same Marketplace Pages deployment:

```text
https://simple-connection.github.io/SCTool_Marketplace_Web/registry/
```

The source code resolves this as `../registry/` relative to `site/assets/registry-client.js`, so the GitHub Pages project path is not hardcoded.

## Validation

```bash
find site/assets -name '*.js' -print0 | xargs -0 -n1 node --check
node scripts/validate-site.mjs
node --test scripts/test-release-catalog-client.mjs
node scripts/validate-registry-hosting.mjs
node --test scripts/test-registry-hosting.mjs
python scripts/verify-registry-handoff.py --lock deployment/registry-handoff/lock.json
node scripts/prepare-pages.mjs --out _site
python scripts/verify-registry-handoff.py --lock deployment/registry-handoff/lock.json --materialize _site/registry
node scripts/validate-registry-hosting.mjs --site-root _site --require-registry
```

## Deployment

`.github/workflows/jekyll.yml` validates all browser modules, the multi-page site contract, the Application Worker release catalog consumer, and the Registry hosting boundary. It then verifies the exact Registry handoff, assembles one Pages artifact, materializes the signed Registry bytes, validates the artifact, deploys it, and verifies that the public `/registry/` bytes still match the accepted handoff.

No Registry signing credentials or Registry signing implementation belong in this repository.

## Browser trust-chain status

The browser consumer validates the head structure, safe snapshot path, snapshot byte size, snapshot SHA-256, and revision/sequence/source identity. It does not currently perform Ed25519 root-signature or distribution-signature verification in the browser. Those signatures are verified by the Registry producer before handoff and recorded as PASS in the accepted producer evidence. Additional browser trust-chain verification requires a separately approved consumer-side verification contract; Registry signing authority must not be duplicated here.
