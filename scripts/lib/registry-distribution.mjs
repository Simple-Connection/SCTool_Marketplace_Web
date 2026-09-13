import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

export class RegistryDistributionError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "RegistryDistributionError";
    this.code = code;
  }
}

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new RegistryDistributionError("INVALID_DISTRIBUTION_JSON", `${label} is not valid JSON.`, error);
  }
}

async function readRequired(path, label) {
  try {
    return await readFile(path);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new RegistryDistributionError(
        "MISSING_REGISTRY_DISTRIBUTION",
        `Required Registry distribution file is missing: ${label}`,
        error,
      );
    }
    throw error;
  }
}

export function assertSafeSnapshotPath(path) {
  if (typeof path !== "string" || !/^snapshots\/[0-9a-f]{40,64}\.json$/.test(path)) {
    throw new RegistryDistributionError(
      "UNSAFE_SNAPSHOT_PATH",
      `Unsafe Registry snapshot path: ${String(path)}`,
    );
  }
  return path;
}

async function listFiles(root) {
  const files = [];

  async function walk(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw new RegistryDistributionError(
          "MISSING_REGISTRY_DISTRIBUTION",
          `Registry distribution directory is missing: ${root}`,
          error,
        );
      }
      throw error;
    }

    for (const entry of entries) {
      const absolute = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new RegistryDistributionError(
          "UNSAFE_DISTRIBUTION_ENTRY",
          `Registry distribution must not contain symbolic links: ${entry.name}`,
        );
      }
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }
      if (!entry.isFile()) {
        throw new RegistryDistributionError(
          "UNSAFE_DISTRIBUTION_ENTRY",
          `Registry distribution contains unsupported entry type: ${entry.name}`,
        );
      }
      files.push(relative(root, absolute).replaceAll("\\", "/"));
    }
  }

  await walk(root);
  return files.sort();
}

function validateTrustEnvelope(trust) {
  if (
    trust?.schemaVersion !== "1.0.0" ||
    trust?.signed?.scope !== "sctool-registry-trust-v1" ||
    !Number.isSafeInteger(trust?.signed?.sequence) ||
    trust.signed.sequence < 1 ||
    trust?.proof?.algorithm !== "ed25519" ||
    trust?.proof?.scope !== trust.signed.scope ||
    trust?.proof?.keyId !== trust?.signed?.rootKeyId ||
    typeof trust?.proof?.signature !== "string" ||
    trust.proof.signature.length === 0
  ) {
    throw new RegistryDistributionError("INVALID_TRUST_ENVELOPE", "Registry trust envelope metadata is invalid.");
  }
}

function validateHeadEnvelope(head) {
  const revision = head?.signed?.revision;
  const snapshot = head?.signed?.snapshot;
  if (
    head?.schemaVersion !== "1.0.0" ||
    head?.signed?.scope !== "sctool-registry-head-v1" ||
    !Number.isSafeInteger(head?.signed?.sequence) ||
    head.signed.sequence < 1 ||
    !/^[0-9a-f]{40,64}$/.test(revision ?? "") ||
    !Number.isSafeInteger(head?.signed?.trustSequence) ||
    head.signed.trustSequence < 1 ||
    head?.proof?.algorithm !== "ed25519" ||
    head?.proof?.scope !== head.signed.scope ||
    head?.proof?.keyId !== head?.signed?.signingKeyId ||
    typeof head?.proof?.signature !== "string" ||
    head.proof.signature.length === 0 ||
    !snapshot ||
    !/^[0-9a-f]{64}$/.test(snapshot.sha256 ?? "") ||
    !Number.isSafeInteger(snapshot.size) ||
    snapshot.size < 1
  ) {
    throw new RegistryDistributionError("INVALID_HEAD_ENVELOPE", "Registry head envelope metadata is invalid.");
  }
  assertSafeSnapshotPath(snapshot.path);
}

export async function validateRegistryDistribution(sourceDirectory) {
  const source = resolve(sourceDirectory);
  const trustBytes = await readRequired(join(source, "trust.json"), "trust.json");
  const headBytes = await readRequired(join(source, "registry-head.json"), "registry-head.json");
  const trust = parseJson(trustBytes, "trust.json");
  const head = parseJson(headBytes, "registry-head.json");

  validateTrustEnvelope(trust);
  validateHeadEnvelope(head);

  if (head.signed.trustSequence !== trust.signed.sequence) {
    throw new RegistryDistributionError(
      "HEAD_TRUST_IDENTITY_MISMATCH",
      "Registry head trustSequence does not match trust.json sequence.",
    );
  }

  const snapshotPath = assertSafeSnapshotPath(head.signed.snapshot.path);
  const snapshotBytes = await readRequired(join(source, ...snapshotPath.split("/")), snapshotPath);
  const snapshot = parseJson(snapshotBytes, snapshotPath);

  if (snapshotBytes.byteLength !== head.signed.snapshot.size) {
    throw new RegistryDistributionError("SNAPSHOT_SIZE_MISMATCH", "Registry snapshot byte size does not match head.");
  }
  if (sha256Hex(snapshotBytes) !== head.signed.snapshot.sha256) {
    throw new RegistryDistributionError("SNAPSHOT_DIGEST_MISMATCH", "Registry snapshot SHA-256 does not match head.");
  }
  if (
    snapshot.revision !== head.signed.revision ||
    snapshot.sequence !== head.signed.sequence ||
    snapshot.source?.repository !== "Simple-Connection/sctool-registry" ||
    snapshot.source?.commit !== head.signed.revision
  ) {
    throw new RegistryDistributionError(
      "SNAPSHOT_IDENTITY_MISMATCH",
      "Registry snapshot identity does not match the signed head/source identity.",
    );
  }

  const actualFiles = await listFiles(source);
  const expectedFiles = ["registry-head.json", "trust.json", snapshotPath].sort();
  if (
    actualFiles.length !== expectedFiles.length ||
    actualFiles.some((path, index) => path !== expectedFiles[index])
  ) {
    throw new RegistryDistributionError(
      "UNEXPECTED_DISTRIBUTION_FILE",
      `Registry distribution boundary must contain exactly: ${expectedFiles.join(", ")}; got: ${actualFiles.join(", ")}`,
    );
  }

  return {
    source,
    revision: head.signed.revision,
    sequence: head.signed.sequence,
    trustSequence: trust.signed.sequence,
    snapshotPath,
    files: new Map([
      ["trust.json", trustBytes],
      ["registry-head.json", headBytes],
      [snapshotPath, snapshotBytes],
    ]),
  };
}

export async function stageRegistryDistribution(sourceDirectory, destinationDirectory) {
  const validated = await validateRegistryDistribution(sourceDirectory);
  const destination = resolve(destinationDirectory);

  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });

  for (const [path, sourceBytes] of validated.files) {
    const output = join(destination, ...path.split("/"));
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, sourceBytes);
    const stagedBytes = await readFile(output);
    if (!stagedBytes.equals(sourceBytes) || sha256Hex(stagedBytes) !== sha256Hex(sourceBytes)) {
      throw new RegistryDistributionError(
        "BYTE_PRESERVATION_FAILURE",
        `Registry distribution file changed while staging: ${path}`,
      );
    }
  }

  const staged = await validateRegistryDistribution(destination);
  return {
    destination,
    revision: staged.revision,
    sequence: staged.sequence,
    trustSequence: staged.trustSequence,
    snapshotPath: staged.snapshotPath,
  };
}
