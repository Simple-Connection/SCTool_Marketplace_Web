import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  RegistryDistributionError,
  stageRegistryDistribution,
  validateRegistryDistribution,
} from "./lib/registry-distribution.mjs";
import {
  MarketplaceDataError,
  loadMarketplace,
} from "../site/assets/registry-client.js";

const REVISION = "a".repeat(40);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function writeFixture(root, {
  revision = REVISION,
  snapshotRevision = revision,
  snapshotSourceCommit = snapshotRevision,
  extraFile = false,
} = {}) {
  const snapshot = {
    schemaVersion: "1.0.0",
    sequence: 7,
    revision: snapshotRevision,
    generatedAt: "2026-09-13T00:00:00Z",
    source: {
      repository: "Simple-Connection/sctool-registry",
      commit: snapshotSourceCommit,
    },
    registrySha256: "0".repeat(64),
    packages: {},
    publishers: {},
    marketplaceProfiles: {},
  };
  const snapshotText = `${JSON.stringify(snapshot, null, 2)}\n`;
  const snapshotBytes = Buffer.from(snapshotText, "utf8");
  const snapshotPath = `snapshots/${revision}.json`;

  const trust = {
    schemaVersion: "1.0.0",
    signed: {
      scope: "sctool-registry-trust-v1",
      sequence: 3,
      issuedAt: "2026-09-13T00:00:00Z",
      rootKeyId: "root-test",
      distributionKeys: [],
    },
    proof: {
      algorithm: "ed25519",
      scope: "sctool-registry-trust-v1",
      keyId: "root-test",
      signature: "signed-elsewhere",
    },
  };

  const head = {
    schemaVersion: "1.0.0",
    signed: {
      scope: "sctool-registry-head-v1",
      sequence: 7,
      revision,
      issuedAt: "2026-09-13T00:00:00Z",
      trustSequence: 3,
      signingKeyId: "distribution-test",
      snapshot: {
        path: snapshotPath,
        sha256: sha256(snapshotBytes),
        size: snapshotBytes.length,
      },
    },
    proof: {
      algorithm: "ed25519",
      scope: "sctool-registry-head-v1",
      keyId: "distribution-test",
      signature: "signed-elsewhere",
    },
  };

  await mkdir(join(root, "snapshots"), { recursive: true });
  await writeFile(join(root, "trust.json"), `${JSON.stringify(trust, null, 2)}\n`);
  await writeFile(join(root, "registry-head.json"), `${JSON.stringify(head, null, 2)}\n`);
  await writeFile(join(root, ...snapshotPath.split("/")), snapshotBytes);
  if (extraFile) await writeFile(join(root, "unexpected.json"), "{}\n");

  return { head, snapshotText, snapshotPath };
}

function fetchSequence(headText, snapshotText, { headStatus = 200 } = {}) {
  return async (url) => {
    const href = String(url);
    if (href.endsWith("registry-head.json")) {
      return {
        ok: headStatus >= 200 && headStatus < 300,
        status: headStatus,
        text: async () => headText,
      };
    }
    return { ok: true, status: 200, text: async () => snapshotText };
  };
}

async function expectMarketplaceCode(promise, code) {
  await assert.rejects(promise, (error) => error instanceof MarketplaceDataError && error.code === code);
}

test("registry distribution stages trust/head/snapshot byte-for-byte under one boundary", async () => {
  const temp = await mkdtemp(join(tmpdir(), "marketplace-registry-stage-"));
  const source = join(temp, "source");
  const destination = join(temp, "pages", "registry");
  try {
    await writeFixture(source);
    const expected = await validateRegistryDistribution(source);
    await stageRegistryDistribution(source, destination);
    const actual = await validateRegistryDistribution(destination);

    assert.deepEqual([...actual.files.keys()], [...expected.files.keys()]);
    for (const [path, bytes] of expected.files) {
      const staged = await readFile(join(destination, ...path.split("/")));
      assert.ok(staged.equals(bytes), `${path} changed while staging`);
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("registry directory boundary rejects unexpected files", async () => {
  const temp = await mkdtemp(join(tmpdir(), "marketplace-registry-boundary-"));
  try {
    await writeFixture(temp, { extraFile: true });
    await assert.rejects(
      validateRegistryDistribution(temp),
      (error) => error instanceof RegistryDistributionError && error.code === "UNEXPECTED_DISTRIBUTION_FILE",
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("missing Registry distribution fails closed", async () => {
  const temp = await mkdtemp(join(tmpdir(), "marketplace-registry-missing-"));
  try {
    await assert.rejects(
      validateRegistryDistribution(temp),
      (error) => error instanceof RegistryDistributionError && error.code === "MISSING_REGISTRY_DISTRIBUTION",
    );
    await expectMarketplaceCode(
      loadMarketplace({
        fetchImpl: fetchSequence("", "", { headStatus: 404 }),
        cryptoImpl: webcrypto,
      }),
      "REGISTRY_NOT_PUBLISHED",
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("browser rejects unsafe snapshot path before snapshot fetch", async () => {
  const head = {
    schemaVersion: "1.0.0",
    signed: {
      scope: "sctool-registry-head-v1",
      sequence: 7,
      revision: REVISION,
      snapshot: {
        path: "../escape.json",
        sha256: "0".repeat(64),
        size: 1,
      },
    },
  };
  await expectMarketplaceCode(
    loadMarketplace({
      fetchImpl: fetchSequence(JSON.stringify(head), ""),
      cryptoImpl: webcrypto,
    }),
    "UNSAFE_SNAPSHOT_PATH",
  );
});

test("browser rejects snapshot digest mismatch", async () => {
  const temp = await mkdtemp(join(tmpdir(), "marketplace-registry-digest-"));
  try {
    const { head, snapshotText } = await writeFixture(temp);
    head.signed.snapshot.sha256 = "0".repeat(64);
    await expectMarketplaceCode(
      loadMarketplace({
        fetchImpl: fetchSequence(JSON.stringify(head), snapshotText),
        cryptoImpl: webcrypto,
      }),
      "SNAPSHOT_DIGEST_MISMATCH",
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("browser rejects head/snapshot revision identity mismatch", async () => {
  const temp = await mkdtemp(join(tmpdir(), "marketplace-registry-identity-"));
  try {
    const otherRevision = "b".repeat(40);
    const { head, snapshotText } = await writeFixture(temp, {
      snapshotRevision: otherRevision,
      snapshotSourceCommit: otherRevision,
    });
    head.signed.snapshot.sha256 = sha256(Buffer.from(snapshotText, "utf8"));
    head.signed.snapshot.size = Buffer.byteLength(snapshotText);
    await expectMarketplaceCode(
      loadMarketplace({
        fetchImpl: fetchSequence(JSON.stringify(head), snapshotText),
        cryptoImpl: webcrypto,
      }),
      "SNAPSHOT_IDENTITY_MISMATCH",
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("staging rejects snapshot source identity mismatch", async () => {
  const temp = await mkdtemp(join(tmpdir(), "marketplace-registry-source-"));
  try {
    await writeFixture(temp, { snapshotSourceCommit: "b".repeat(40) });
    await assert.rejects(
      validateRegistryDistribution(temp),
      (error) => error instanceof RegistryDistributionError && error.code === "SNAPSHOT_IDENTITY_MISMATCH",
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
