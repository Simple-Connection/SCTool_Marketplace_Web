# SCTool Marketplace Web

Human-facing, read-only Marketplace UI for the canonical SCTool Registry.

## Authority boundary

```text
Simple-Connection/sctool-registry
  -> signed Registry distribution
  -> immutable snapshot
  -> marketplaceProfiles + packages + publishers
  -> SCTool_Marketplace_Web presentation and public hosting
```

This repository owns Marketplace presentation, static-site assembly, GitHub Pages deployment, browser fetch configuration, and the future public hosting boundary for already-signed Registry distribution bytes.

This repository does not own SCTool package admission, publisher identity, Registry canonical data, Registry schemas, trust policy, root/distribution signing, snapshot generation, package artifact delivery, or Registry private keys. Registry distribution bytes staged here must be hosted without re-signing or content transformation.

## Current contract target

The Marketplace profile/index projection is currently implemented on the canonical Registry repository:

```text
Simple-Connection/sctool-registry
```

The production web app still reads the existing Registry Pages endpoint:

```text
https://simple-connection.github.io/sctool-registry/registry-head.json
```

Phase 1 of the single-Pages-host migration only prepares the Marketplace Pages artifact to accept a validated `/registry/` directory. It does not change the production Registry endpoint. Production cutover remains blocked until an approved Registry handoff provides immutable source identity and artifact digest evidence.

Until Registry Marketplace data is published and valid, the UI fails closed and shows a Registry availability state instead of sample/fake tools.

## Prepared public layout

```text
/
├─ index.html
├─ assets/
└─ registry/                  # materialized only from an externally produced signed bundle
   ├─ trust.json
   ├─ registry-head.json
   └─ snapshots/{revision}.json
```

The `site/registry/` path is intentionally not a source-data authority. Registry files are staged into the generated Pages artifact only through the byte-preserving distribution boundary.

## Local preview

Serve the `site/` directory with any static HTTP server. Direct `file://` use is not recommended because browser fetch/CORS behavior differs.

## Validation

```bash
node --check site/assets/registry-client.js
node --check site/assets/app.js
node scripts/validate-site.mjs
node scripts/validate-registry-hosting.mjs
node --test scripts/test-registry-hosting.mjs
node scripts/prepare-pages.mjs --out _site
node scripts/validate-registry-hosting.mjs --site-root _site
```

## Deployment

`.github/workflows/jekyll.yml` is retained only as the historical workflow filename. Its contents do not use Jekyll. The workflow validates the Marketplace, runs the Registry hosting-boundary tests, assembles `_site/`, validates the assembled artifact, and deploys that single artifact through GitHub Pages Actions.

No Registry signing credentials or Registry signing implementation belong in this repository.
