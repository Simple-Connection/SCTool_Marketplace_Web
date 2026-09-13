export const REGISTRY_BASE_URL = "https://simple-connection.github.io/sctool-registry/";

export class MarketplaceDataError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "MarketplaceDataError";
    this.code = code;
  }
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function assertRegistryHead(head) {
  if (!isObject(head) || !isObject(head.signed)) {
    throw new MarketplaceDataError("INVALID_HEAD", "Registry head 형식을 확인할 수 없습니다.");
  }
  const { revision, sequence, snapshot } = head.signed;
  if (!nonEmptyString(revision) || !Number.isSafeInteger(sequence) || sequence < 1 || !isObject(snapshot)) {
    throw new MarketplaceDataError("INVALID_HEAD", "Registry head의 revision/sequence/snapshot이 올바르지 않습니다.");
  }
  if (!/^[0-9a-f]{40,64}$/.test(revision)) {
    throw new MarketplaceDataError("INVALID_HEAD", "Registry head의 revision 형식이 올바르지 않습니다.");
  }
  if (
    !nonEmptyString(snapshot.path) ||
    !/^[0-9a-f]{64}$/.test(snapshot.sha256 ?? "") ||
    !Number.isSafeInteger(snapshot.size) ||
    snapshot.size < 1
  ) {
    throw new MarketplaceDataError("INVALID_HEAD", "Registry snapshot 위치, SHA-256 또는 크기가 올바르지 않습니다.");
  }
}

export function resolveSnapshotUrl(path, baseUrl = REGISTRY_BASE_URL) {
  if (
    !nonEmptyString(path) ||
    !/^snapshots\/[0-9a-f]{40,64}\.json$/.test(path) ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.split("/").includes("..")
  ) {
    throw new MarketplaceDataError("UNSAFE_SNAPSHOT_PATH", "Registry snapshot 경로가 안전하지 않습니다.");
  }

  const base = new URL(baseUrl);
  const url = new URL(path, base);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
    throw new MarketplaceDataError("UNSAFE_SNAPSHOT_PATH", "Registry snapshot이 허용된 배포 경계를 벗어났습니다.");
  }
  return url;
}

async function fetchText(url, cache = "default", fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") {
    throw new MarketplaceDataError("NETWORK_UNAVAILABLE", "Registry fetch 기능을 사용할 수 없습니다.");
  }

  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache,
      credentials: "omit",
    });
  } catch (error) {
    throw new MarketplaceDataError("NETWORK_UNAVAILABLE", "Registry에 연결할 수 없습니다.", error);
  }

  if (!response.ok) {
    const code = response.status === 404 ? "REGISTRY_NOT_PUBLISHED" : "REGISTRY_HTTP_ERROR";
    throw new MarketplaceDataError(
      code,
      response.status === 404
        ? "Marketplace Registry 데이터가 아직 게시되지 않았습니다."
        : `Registry 요청이 실패했습니다. HTTP ${response.status}`,
    );
  }
  return response.text();
}

async function sha256Hex(text, cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl?.subtle) {
    throw new MarketplaceDataError("CRYPTO_UNAVAILABLE", "브라우저의 SHA-256 검증 기능을 사용할 수 없습니다.");
  }
  const bytes = new TextEncoder().encode(text);
  const digest = await cryptoImpl.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new MarketplaceDataError("INVALID_JSON", `${label} JSON을 해석할 수 없습니다.`, error);
  }
}

function validMarketplaceProfile(profile) {
  return (
    isObject(profile) &&
    profile.schemaVersion === 1 &&
    nonEmptyString(profile.details) &&
    nonEmptyString(profile.features)
  );
}

function currentVersionOf(packageDescriptor) {
  if (!isObject(packageDescriptor)) return "";
  const channel = packageDescriptor.defaultChannel;
  if (!nonEmptyString(channel) || !isObject(packageDescriptor.channels)) return "";
  const version = packageDescriptor.channels[channel];
  return nonEmptyString(version) ? version : "";
}

function artifactsOf(packageDescriptor, version) {
  if (
    !nonEmptyString(version) ||
    !isObject(packageDescriptor?.versions) ||
    !isObject(packageDescriptor.versions[version]?.artifacts)
  ) return [];

  return Object.entries(packageDescriptor.versions[version].artifacts)
    .map(([target, artifact]) => {
      const content = isObject(artifact?.content) ? artifact.content : {};
      return {
        target,
        filename: nonEmptyString(content.filename) ? content.filename : "",
        size: Number.isSafeInteger(content.size) ? content.size : null,
      };
    })
    .sort((a, b) => a.target.localeCompare(b.target));
}

function publisherName(publisherId, publishers) {
  const publisher = isObject(publishers?.[publisherId]) ? publishers[publisherId] : null;
  return nonEmptyString(publisher?.displayName) ? publisher.displayName : publisherId;
}

export function projectMarketplace(snapshot) {
  if (!isObject(snapshot)) {
    throw new MarketplaceDataError("INVALID_SNAPSHOT", "Registry snapshot 형식을 확인할 수 없습니다.");
  }

  const packages = isObject(snapshot.packages) ? snapshot.packages : {};
  const publishers = isObject(snapshot.publishers) ? snapshot.publishers : {};
  const profiles = isObject(snapshot.marketplaceProfiles) ? snapshot.marketplaceProfiles : {};

  const items = [];
  let skipped = 0;

  for (const packageId of Object.keys(profiles).sort()) {
    const packageDescriptor = packages[packageId];
    const profile = profiles[packageId];

    if (!isObject(packageDescriptor) || !validMarketplaceProfile(profile)) {
      skipped += 1;
      continue;
    }

    const publisherId = nonEmptyString(packageDescriptor.publisher) ? packageDescriptor.publisher : "";
    const version = currentVersionOf(packageDescriptor);
    const sourceRepository =
      isObject(packageDescriptor.source) && nonEmptyString(packageDescriptor.source.repository)
        ? packageDescriptor.source.repository
        : "";

    items.push({
      id: packageId,
      publisherId,
      publisherName: publisherName(publisherId, publishers),
      defaultChannel: nonEmptyString(packageDescriptor.defaultChannel)
        ? packageDescriptor.defaultChannel
        : "",
      version,
      sourceRepository,
      sourceVisibility: isObject(packageDescriptor.source) && nonEmptyString(packageDescriptor.source.visibility)
        ? packageDescriptor.source.visibility
        : "",
      artifacts: artifactsOf(packageDescriptor, version),
      profile: {
        schemaVersion: 1,
        details: profile.details,
        features: profile.features,
        changelog: typeof profile.changelog === "string" ? profile.changelog : "",
        dependencies: typeof profile.dependencies === "string" ? profile.dependencies : "",
        extension_pack: typeof profile.extension_pack === "string" ? profile.extension_pack : "",
      },
    });
  }

  return { items, skipped };
}

export async function loadMarketplace({
  baseUrl = REGISTRY_BASE_URL,
  fetchImpl = globalThis.fetch,
  cryptoImpl = globalThis.crypto,
} = {}) {
  const headUrl = new URL("registry-head.json", baseUrl);
  const headText = await fetchText(headUrl, "no-store", fetchImpl);
  const head = parseJson(headText, "Registry head");
  assertRegistryHead(head);

  const snapshotUrl = resolveSnapshotUrl(head.signed.snapshot.path, baseUrl);
  const snapshotText = await fetchText(snapshotUrl, "default", fetchImpl);
  const snapshotBytes = new TextEncoder().encode(snapshotText);
  if (snapshotBytes.byteLength !== head.signed.snapshot.size) {
    throw new MarketplaceDataError(
      "SNAPSHOT_SIZE_MISMATCH",
      "Registry snapshot 크기 검증에 실패했습니다.",
    );
  }

  const actualSha256 = await sha256Hex(snapshotText, cryptoImpl);
  const expectedSha256 = head.signed.snapshot.sha256.toLowerCase();

  if (actualSha256 !== expectedSha256) {
    throw new MarketplaceDataError(
      "SNAPSHOT_DIGEST_MISMATCH",
      "Registry snapshot SHA-256 검증에 실패했습니다.",
    );
  }

  const snapshot = parseJson(snapshotText, "Registry snapshot");
  if (
    snapshot.revision !== head.signed.revision ||
    snapshot.sequence !== head.signed.sequence ||
    snapshot.source?.commit !== head.signed.revision
  ) {
    throw new MarketplaceDataError(
      "SNAPSHOT_IDENTITY_MISMATCH",
      "Registry head와 snapshot의 revision/sequence/source identity가 일치하지 않습니다.",
    );
  }

  const projected = projectMarketplace(snapshot);
  return {
    ...projected,
    provenance: {
      revision: snapshot.revision,
      sequence: snapshot.sequence,
      generatedAt: snapshot.generatedAt ?? "",
      sourceRepository: snapshot.source?.repository ?? "Simple-Connection/sctool-registry",
    },
  };
}
