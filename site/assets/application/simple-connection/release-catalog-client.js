export const SIMPLE_CONNECTION_RELEASE_CATALOG_URL =
  "https://www.kswdeveloper.cloud/application/simple_connection/releases";

const EXPECTED_SCHEMA_VERSION = 1;
const MAX_DIAGNOSTIC_BODY_LENGTH = 1000;

export class ReleaseCatalogError extends Error {
  constructor(code, message, { cause, url = "", status = null, responseBody = "" } = {}) {
    super(message);
    this.name = "ReleaseCatalogError";
    this.code = code;
    this.url = url;
    this.status = status;
    this.responseBody = responseBody;
    if (cause) this.cause = cause;
  }

  diagnosticText() {
    const details = [];
    if (this.url) details.push("URL " + this.url);
    if (Number.isInteger(this.status)) details.push("HTTP " + String(this.status));
    if (this.responseBody) details.push("Response " + this.responseBody);
    return details.length ? this.message + " · " + details.join(" · ") : this.message;
  }
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function assertOptionalString(value, field, index) {
  if (value === undefined || value === null || value === "") return "";
  if (!nonEmptyString(value)) {
    throw new ReleaseCatalogError(
      "INVALID_RELEASE",
      "Release catalog 항목 #" + String(index + 1) + "의 " + field + " 필드가 올바르지 않습니다."
    );
  }
  return value;
}

function assertAbsoluteHttpUrl(value, field, index) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw new ReleaseCatalogError(
      "INVALID_RELEASE",
      "Release catalog 항목 #" + String(index + 1) + "의 " + field + " 필드가 절대 URL이 아닙니다.",
      { cause: error }
    );
  }

  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new ReleaseCatalogError(
      "INVALID_RELEASE",
      "Release catalog 항목 #" + String(index + 1) + "의 " + field + " 필드는 HTTP(S) 공개 URL이어야 합니다."
    );
  }
  return value;
}

function validateRelease(release, index) {
  if (
    !isObject(release) ||
    !nonEmptyString(release.version) ||
    !nonEmptyString(release.fileName) ||
    !nonEmptyString(release.downloadUrl) ||
    typeof release.latest !== "boolean"
  ) {
    throw new ReleaseCatalogError(
      "INVALID_RELEASE",
      "Release catalog 항목 #" + String(index + 1) + "의 필수 필드가 올바르지 않습니다."
    );
  }

  const releasedAt = assertOptionalString(release.releasedAt, "releasedAt", index);
  if (releasedAt && Number.isNaN(Date.parse(releasedAt))) {
    throw new ReleaseCatalogError(
      "INVALID_RELEASE_DATE",
      "Release catalog 항목 #" + String(index + 1) + "의 releasedAt 값을 해석할 수 없습니다."
    );
  }

  if (
    release.size !== undefined &&
    release.size !== null &&
    (!Number.isSafeInteger(release.size) || release.size < 0)
  ) {
    throw new ReleaseCatalogError(
      "INVALID_RELEASE",
      "Release catalog 항목 #" + String(index + 1) + "의 size 필드가 올바르지 않습니다."
    );
  }

  return {
    version: release.version,
    updaterVersion: assertOptionalString(release.updaterVersion, "updaterVersion", index),
    platform: assertOptionalString(release.platform, "platform", index),
    arch: assertOptionalString(release.arch, "arch", index),
    channel: assertOptionalString(release.channel, "channel", index),
    fileName: release.fileName,
    size: release.size ?? null,
    releasedAt,
    latest: release.latest,
    downloadUrl: assertAbsoluteHttpUrl(release.downloadUrl, "downloadUrl", index)
  };
}

export function validateReleaseCatalog(payload) {
  if (!isObject(payload)) {
    throw new ReleaseCatalogError("INVALID_CATALOG", "Release catalog 응답이 JSON object가 아닙니다.");
  }

  if (payload.schemaVersion !== EXPECTED_SCHEMA_VERSION) {
    if (Number.isInteger(payload.schemaVersion)) {
      throw new ReleaseCatalogError(
        "UNSUPPORTED_SCHEMA_VERSION",
        "지원하지 않는 release catalog schemaVersion입니다: " + String(payload.schemaVersion)
      );
    }
    throw new ReleaseCatalogError("INVALID_CATALOG", "Release catalog schemaVersion이 올바르지 않습니다.");
  }

  if (
    !nonEmptyString(payload.latestVersion) ||
    !nonEmptyString(payload.platform) ||
    !nonEmptyString(payload.arch) ||
    !Array.isArray(payload.releases)
  ) {
    throw new ReleaseCatalogError("INVALID_CATALOG", "Release catalog 필수 필드 구조가 올바르지 않습니다.");
  }

  const seenVersions = new Set();
  const releases = payload.releases.map((release, index) => {
    const validated = validateRelease(release, index);
    if (seenVersions.has(validated.version)) {
      throw new ReleaseCatalogError(
        "DUPLICATE_RELEASE",
        "Release catalog에 중복 version이 있습니다: " + validated.version
      );
    }
    seenVersions.add(validated.version);
    return validated;
  });

  if (releases.length) {
    const promoted = releases.filter((release) => release.latest === true);
    if (promoted.length !== 1 || promoted[0].version !== payload.latestVersion) {
      throw new ReleaseCatalogError(
        "LATEST_RELEASE_MISMATCH",
        "release.latest와 latestVersion의 canonical latest 상태가 일치하지 않습니다."
      );
    }
  }

  return {
    schemaVersion: payload.schemaVersion,
    latestVersion: payload.latestVersion,
    platform: payload.platform,
    arch: payload.arch,
    releases
  };
}

function safeResponseBody(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_DIAGNOSTIC_BODY_LENGTH);
}

function httpError(status, url, responseBody) {
  const details = {
    url,
    status,
    responseBody: safeResponseBody(responseBody)
  };

  if (status === 403) {
    return new ReleaseCatalogError(
      "CATALOG_ACCESS_DENIED",
      "Release catalog 접근이 거부되었습니다.",
      details
    );
  }
  if (status === 404) {
    return new ReleaseCatalogError(
      "CATALOG_NOT_FOUND",
      "Release catalog endpoint를 찾을 수 없습니다.",
      details
    );
  }
  if (status >= 500) {
    return new ReleaseCatalogError(
      "CATALOG_SERVER_ERROR",
      "Release catalog 서버 오류가 발생했습니다.",
      details
    );
  }
  return new ReleaseCatalogError(
    "CATALOG_HTTP_ERROR",
    "Release catalog HTTP 요청이 실패했습니다.",
    details
  );
}

export async function fetchReleaseCatalog({
  catalogUrl = SIMPLE_CONNECTION_RELEASE_CATALOG_URL,
  fetchImpl = globalThis.fetch
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new ReleaseCatalogError(
      "NETWORK_UNAVAILABLE",
      "Release catalog fetch 기능을 사용할 수 없습니다.",
      { url: catalogUrl }
    );
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(catalogUrl);
  } catch (error) {
    throw new ReleaseCatalogError(
      "INVALID_CATALOG_URL",
      "Release catalog URL이 올바르지 않습니다.",
      { cause: error, url: String(catalogUrl ?? "") }
    );
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw new ReleaseCatalogError(
      "INVALID_CATALOG_URL",
      "Release catalog URL은 HTTP(S) 절대 URL이어야 합니다.",
      { url: parsedUrl.href }
    );
  }

  let response;
  try {
    response = await fetchImpl(parsedUrl.href, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "omit"
    });
  } catch (error) {
    throw new ReleaseCatalogError(
      "NETWORK_ERROR",
      "Release catalog 네트워크 요청에 실패했습니다.",
      { cause: error, url: parsedUrl.href }
    );
  }

  let body;
  try {
    body = await response.text();
  } catch (error) {
    throw new ReleaseCatalogError(
      "CATALOG_RESPONSE_ERROR",
      "Release catalog 응답 본문을 읽을 수 없습니다.",
      { cause: error, url: parsedUrl.href, status: response.status }
    );
  }

  if (!response.ok) {
    throw httpError(response.status, parsedUrl.href, body);
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch (error) {
    throw new ReleaseCatalogError(
      "INVALID_JSON",
      "Release catalog JSON을 해석할 수 없습니다.",
      {
        cause: error,
        url: parsedUrl.href,
        status: response.status,
        responseBody: safeResponseBody(body)
      }
    );
  }

  return validateReleaseCatalog(payload);
}

export async function loadReleaseCatalog(options = {}) {
  return fetchReleaseCatalog(options);
}
