# SCTool Marketplace Web

Human-facing, read-only Marketplace UI for the canonical SCTool Registry.

## Authority boundary

```text
Simple-Connection/sctool-registry
  -> signed GitHub Pages registry-head.json
  -> immutable snapshot
  -> marketplaceProfiles + packages + publishers
  -> SCTool_Marketplace_Web presentation
```

This repository does not own SCTool package admission, Marketplace eligibility, publisher identity, artifact delivery, installation, or Registry trust policy.

Marketplace membership is derived only from the canonical Registry snapshot:

- a package must exist in `snapshot.packages`;
- a Marketplace profile must exist under the same package id in `snapshot.marketplaceProfiles`;
- the profile must satisfy the Registry Marketplace Profile v1 contract.

The web UI never synthesizes missing Marketplace profile content.

## Current contract target

The Marketplace profile/index projection is currently implemented on:

```text
Simple-Connection/sctool-registry
branch: dev/1.0.3
```

The production web app reads the canonical published Registry Pages endpoint:

```text
https://simple-connection.github.io/sctool-registry/registry-head.json
```

Until Registry 1.0.3 Marketplace data is published, the UI fails closed and shows a Registry availability state instead of sample/fake tools.

## Local preview

Serve the `site/` directory with any static HTTP server. Direct `file://` use is not recommended because browser fetch/CORS behavior differs.

## Validation

```bash
node --check site/assets/registry-client.js
node --check site/assets/app.js
node scripts/validate-site.mjs
```

## Deployment

`.github/workflows/jekyll.yml` is retained only as the historical workflow filename. Its contents no longer use Jekyll; it validates and deploys the static `site/` directory through GitHub Pages Actions.
