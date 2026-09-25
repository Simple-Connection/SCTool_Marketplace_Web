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

Simple Connection release publication and the public release contract are owned by `Simple-Connection/SC_Linked_App`. SC_WEP is a presentation-only consumer of the canonical catalog endpoint:

```text
GET https://www.kswdeveloper.cloud/application/simple_connection/releases
```

`site/assets/application/simple-connection/release-catalog-client.js` exposes this exact URL as `SIMPLE_CONNECTION_RELEASE_CATALOG_URL`. The browser must not derive the catalog endpoint from `window.location.origin`, the current Pages hostname, or a relative Application Worker route.

The download UI is published at:

```text
/application/simple_connection/downloads/
```

SC_WEP validates `schemaVersion === 1`, renders the release history in the order supplied by SC_Linked_App, and treats `release.latest === true` as the primary Latest/Previous UI authority. `latestVersion` is consistency information; SC_WEP does not sort compact versions or implement product/updater version conversion.

Each installer link uses the API-provided `downloadUrl` directly. SC_WEP does not access release infrastructure, reconstruct artifact paths, maintain a release manifest/database, implement a second stable/latest pointer, or depend on infrastructure-provider APIs, SDKs, credentials, challenges, storage, or fallback endpoints. If the UI needs a release field the canonical catalog does not provide, the contract must be extended in SC_Linked_App first.

The approved public-access and consumer-independence policy is recorded in `docs/policy/integration/simple_connection_release_public_access.md`. The production gate verifies the canonical catalog through the actual deployed SC_WEP browser origin, requires GET/HEAD access and JSON content, validates CORS readability, and checks the API-provided latest `downloadUrl` with HEAD.

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
node --test scripts/test-release-view-model.mjs
node --test scripts/test-release-page-view.mjs
node scripts/validate-simple-connection-provider-independence.mjs
node --test scripts/test-simple-connection-provider-independence.mjs
node --test scripts/test-simple-connection-public-release.mjs
node scripts/verify-simple-connection-release-catalog.mjs --consumer-url "https://simple-connection.github.io/SCTool_Marketplace_Web/"
node scripts/validate-registry-hosting.mjs
node --test scripts/test-registry-hosting.mjs
python scripts/verify-registry-handoff.py --lock deployment/registry-handoff/lock.json
node scripts/prepare-pages.mjs --out _site
python scripts/verify-registry-handoff.py --lock deployment/registry-handoff/lock.json --materialize _site/registry
node scripts/validate-registry-hosting.mjs --site-root _site --require-registry
```

## Deployment

`.github/workflows/jekyll.yml` validates all browser modules, the multi-page site contract, the SC_Linked_App release catalog consumer, and the Registry hosting boundary. It then verifies the exact Registry handoff, assembles one Pages artifact, materializes the signed Registry bytes, validates the artifact, deploys it, and verifies that the public `/registry/` bytes still match the accepted handoff.

No Registry signing credentials or Registry signing implementation belong in this repository.

## Browser trust-chain status

The browser consumer validates the head structure, safe snapshot path, snapshot byte size, snapshot SHA-256, and revision/sequence/source identity. It does not currently perform Ed25519 root-signature or distribution-signature verification in the browser. Those signatures are verified by the Registry producer before handoff and recorded as PASS in the accepted producer evidence. Additional browser trust-chain verification requires a separately approved consumer-side verification contract; Registry signing authority must not be duplicated here.
