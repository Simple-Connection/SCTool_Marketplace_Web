export const RELEASES_PATH = "/application/simple_connection/update/desktop/win/x64/releases";
const DOWNLOAD_PREFIX = RELEASES_PATH + "/";

export class ReleaseCatalogError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "ReleaseCatalogError";
    this.code = code;
  }
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function assertWorkerBaseUrl(baseUrl) {
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch (error) {
    throw new ReleaseCatalogError("INVALID_WORKER_BASE", "Application Worker base URL이 올바르지 않습니다.", error);
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new ReleaseCatalogError("INVALID_WORKER_BASE", "Application Worker base URL은 HTTP(S) origin이어야 합니다.");
  }
  return parsed;
}

export function getApplicationWorkerBaseUrl({
  documentRef = globalThis.document,
  locationRef = globalThis.location
} = {}) {
  const configured = documentRef?.querySelector?.('meta[name="application-worker-base"]')?.content?.trim();
  if (configured) {
    return assertWorkerBaseUrl(new URL(configured, locationRef?.href || "https://invalid.local/").href);
  }
  if (!locationRef?.origin) {
    throw new ReleaseCatalogError("WORKER_BASE_UNAVAILABLE", "Application Worker base URL을 결정할 수 없습니다.");
  }
  return assertWorkerBaseUrl(locationRef.origin + "/");
}

export function resolveReleaseDownloadUrl(downloadUrl, baseUrl) {
  if (!nonEmptyString(downloadUrl) || !downloadUrl.startsWith(DOWNLOAD_PREFIX)) {
    throw new ReleaseCatalogError("UNSAFE_DOWNLOAD_URL", "Release downloadUrl이 허용된 update namespace를 벗어났습니다.");
  }
  if (downloadUrl.includes("\\") || downloadUrl.split("/").includes("..")) {
    throw new ReleaseCatalogError("UNSAFE_DOWNLOAD_URL", "Release downloadUrl 경로가 안전하지 않습니다.");
  }

  const base = assertWorkerBaseUrl(baseUrl);
  const resolved = new URL(downloadUrl, base);
  if (
    resolved.origin !== base.origin ||
    !resolved.pathname.startsWith(DOWNLOAD_PREFIX) ||
    !["http:", "https:"].includes(resolved.protocol)
  ) {
    throw new ReleaseCatalogError("UNSAFE_DOWNLOAD_URL", "Release downloadUrl이 Application Worker 경계를 벗어났습니다.");
  }
  return resolved.href;
}

export function validateReleaseCatalog(payload, { baseUrl } = {}) {
  if (!isObject(payload) || !nonEmptyString(payload.latestVersion) || !Array.isArray(payload.releases)) {
    throw new ReleaseCatalogError("INVALID_CATALOG", "Release catalog 형식을 확인할 수 없습니다.");
  }

  const workerBase = assertWorkerBaseUrl(baseUrl);
  const seen = new Set();
  const releases = payload.releases.map((release) => {
    if (
      !isObject(release) ||
      !nonEmptyString(release.version) ||
      !nonEmptyString(release.displayVersion) ||
      !nonEmptyString(release.releasedAt) ||
      !Number.isSafeInteger(release.size) ||
      release.size < 0 ||
      !nonEmptyString(release.downloadUrl)
    ) {
      throw new ReleaseCatalogError("INVALID_RELEASE", "Release catalog 항목의 필수 필드가 올바르지 않습니다.");
    }
    if (seen.has(release.version)) {
      throw new ReleaseCatalogError("DUPLICATE_RELEASE", "Release catalog에 중복 version이 있습니다.");
    }
    seen.add(release.version);

    if (Number.isNaN(Date.parse(release.releasedAt))) {
      throw new ReleaseCatalogError("INVALID_RELEASE_DATE", "Release releasedAt 값을 해석할 수 없습니다.");
    }

    return {
      version: release.version,
      displayVersion: release.displayVersion,
      releasedAt: release.releasedAt,
      size: release.size,
      downloadUrl: release.downloadUrl,
      resolvedDownloadUrl: resolveReleaseDownloadUrl(release.downloadUrl, workerBase.href)
    };
  });

  const latestMatches = releases.filter((release) => release.version === payload.latestVersion);
  if (latestMatches.length !== 1) {
    throw new ReleaseCatalogError("LATEST_RELEASE_MISMATCH", "latestVersion과 일치하는 release가 정확히 하나 존재해야 합니다.");
  }

  return {
    latestVersion: payload.latestVersion,
    releases
  };
}

async function fetchCatalog(url, fetchImpl) {
  if (typeof fetchImpl !== "function") {
    throw new ReleaseCatalogError("NETWORK_UNAVAILABLE", "Release catalog fetch 기능을 사용할 수 없습니다.");
  }

  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "omit"
    });
  } catch (error) {
    throw new ReleaseCatalogError("NETWORK_UNAVAILABLE", "Application Worker에 연결할 수 없습니다.", error);
  }

  if (!response.ok) {
    throw new ReleaseCatalogError("CATALOG_HTTP_ERROR", "Release catalog 요청이 실패했습니다. HTTP " + String(response.status));
  }

  try {
    return await response.json();
  } catch (error) {
    throw new ReleaseCatalogError("INVALID_JSON", "Release catalog JSON을 해석할 수 없습니다.", error);
  }
}

export async function loadReleaseCatalog({
  baseUrl = getApplicationWorkerBaseUrl().href,
  fetchImpl = globalThis.fetch
} = {}) {
  const workerBase = assertWorkerBaseUrl(baseUrl);
  const catalogUrl = new URL(RELEASES_PATH, workerBase);
  const payload = await fetchCatalog(catalogUrl, fetchImpl);
  return validateReleaseCatalog(payload, { baseUrl: workerBase.href });
}
