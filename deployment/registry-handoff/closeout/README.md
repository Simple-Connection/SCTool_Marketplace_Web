# Registry Pages retirement closeout package

This directory is the Marketplace-side handoff record for the owner of `Simple-Connection/sctool-registry`.

## Decision

`registry-pages-retirement-closeout.json` records:

```text
status = READY_FOR_REGISTRY_OWNER_CLOSEOUT
safeToRetireWithoutRepeatingMarketplaceVerification = true
```

The completed Marketplace verification proves that:

- the exact Registry signed handoff was accepted;
- the signed bytes were materialized byte-for-byte;
- the public Marketplace `/registry/` endpoint matches those bytes;
- the browser Registry endpoint was cut over to the Marketplace Pages host;
- W1 through W7 passed.

The final deployment evidence from Marketplace workflow run `34757891344` is persisted as
`registry-hosting-deployment-evidence.json` so the evidence does not disappear when the GitHub Actions artifact retention window expires.

## Retirement boundary

The Registry owner may retire the **legacy GitHub Pages publication responsibility** without repeating the Marketplace verification represented by this package.

Do not remove the Registry workflow's signed distribution and handoff-production responsibilities. In the current Registry `.github/workflows/pages.yml`, the Pages publication steps coexist with the producer steps.

The closeout record therefore identifies the Pages-only targets and separately lists the steps that must remain.

## Non-claim

This package establishes that SCTool_Marketplace_Web no longer depends on
`https://simple-connection.github.io/sctool-registry/`.

It does not claim that unknown third-party consumers of that legacy URL do not exist.
