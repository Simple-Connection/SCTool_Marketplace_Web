import {
  SIMPLE_CONNECTION_RELEASE_CATALOG_URL,
  ReleaseCatalogError,
  isJsonContentType,
  loadReleaseCatalog
} from "../../site/assets/application/simple-connection/release-catalog-client.js";

function responseHeader(response, name) {
  return response?.headers?.get?.(name) ?? "";
}

function consumerOriginFromUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw new ReleaseCatalogError(
      "INVALID_CONSUMER_URL",
      "SC_WEP public consumer URL이 올바르지 않습니다.",
      { cause: error, url: String(value ?? "") }
    );
  }

  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new ReleaseCatalogError(
      "INVALID_CONSUMER_URL",
      "SC_WEP public consumer URL은 HTTP(S) 공개 URL이어야 합니다.",
      { url: parsed.href }
    );
  }

  return parsed.origin;
}

async function requestHead({
  url,
  fetchImpl,
  accept,
  origin = "",
  networkCode,
  httpCode,
  label
}) {
  const headers = { Accept: accept };
  if (origin) headers.Origin = origin;

  let response;
  try {
    response = await fetchImpl(url, {
      method: "HEAD",
      headers,
      redirect: "follow",
      credentials: "omit"
    });
  } catch (error) {
    throw new ReleaseCatalogError(
      networkCode,
      label + " HEAD 네트워크 요청에 실패했습니다.",
      { cause: error, url }
    );
  }

  if (!response.ok) {
    throw new ReleaseCatalogError(
      httpCode,
      label + " HEAD 요청이 실패했습니다.",
      { url, status: response.status }
    );
  }

  return response;
}

function assertCatalogHeadContentType(response, url) {
  const contentType = responseHeader(response, "content-type");
  if (!isJsonContentType(contentType)) {
    throw new ReleaseCatalogError(
      "CATALOG_HEAD_INVALID_CONTENT_TYPE",
      "Release catalog HEAD 응답 Content-Type이 JSON이 아닙니다.",
      { url, status: response.status }
    );
  }
  return contentType;
}

function assertBrowserCors({ response, catalogUrl, consumerOrigin }) {
  const catalogOrigin = new URL(catalogUrl).origin;
  const allowOrigin = responseHeader(response, "access-control-allow-origin").trim();

  if (
    catalogOrigin !== consumerOrigin &&
    allowOrigin !== "*" &&
    allowOrigin !== consumerOrigin
  ) {
    throw new ReleaseCatalogError(
      "BROWSER_CORS_DENIED",
      "SC_WEP browser origin에서 canonical release catalog를 읽을 수 없습니다.",
      { url: catalogUrl, status: response.status }
    );
  }

  return allowOrigin;
}

export async function verifySimpleConnectionPublicRelease({
  consumerUrl,
  catalogUrl = SIMPLE_CONNECTION_RELEASE_CATALOG_URL,
  fetchImpl = globalThis.fetch
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new ReleaseCatalogError(
      "NETWORK_UNAVAILABLE",
      "Public release verification fetch 기능을 사용할 수 없습니다.",
      { url: catalogUrl }
    );
  }

  const consumerOrigin = consumerOriginFromUrl(consumerUrl);

  const catalogHeadResponse = await requestHead({
    url: catalogUrl,
    fetchImpl,
    accept: "application/json",
    origin: consumerOrigin,
    networkCode: "CATALOG_HEAD_NETWORK_ERROR",
    httpCode: "CATALOG_HEAD_HTTP_ERROR",
    label: "Canonical release catalog"
  });
  const catalogHeadContentType = assertCatalogHeadContentType(
    catalogHeadResponse,
    catalogUrl
  );

  let browserGetResponse = null;
  const browserFetch = async (url, options = {}) => {
    const response = await fetchImpl(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Origin: consumerOrigin
      }
    });
    browserGetResponse = response;
    return response;
  };

  const catalog = await loadReleaseCatalog({
    catalogUrl,
    fetchImpl: browserFetch
  });

  if (!browserGetResponse) {
    throw new ReleaseCatalogError(
      "BROWSER_CATALOG_REQUEST_MISSING",
      "SC_WEP browser-origin catalog request가 실행되지 않았습니다.",
      { url: catalogUrl }
    );
  }

  const allowOrigin = assertBrowserCors({
    response: browserGetResponse,
    catalogUrl,
    consumerOrigin
  });

  const latest = catalog.releases.find((release) => release.latest === true);
  if (!latest) {
    throw new ReleaseCatalogError(
      "LIVE_CATALOG_EMPTY",
      "Canonical Simple Connection release catalog에 검증 가능한 latest release가 없습니다.",
      { url: catalogUrl }
    );
  }

  const downloadHeadResponse = await requestHead({
    url: latest.downloadUrl,
    fetchImpl,
    accept: "*/*",
    networkCode: "DOWNLOAD_HEAD_NETWORK_ERROR",
    httpCode: "DOWNLOAD_HEAD_HTTP_ERROR",
    label: "Canonical release artifact"
  });

  return {
    catalogUrl,
    consumerOrigin,
    schemaVersion: catalog.schemaVersion,
    latestVersion: catalog.latestVersion,
    releaseCount: catalog.releases.length,
    catalogHead: {
      status: catalogHeadResponse.status,
      contentType: catalogHeadContentType
    },
    browserCatalogGet: {
      status: browserGetResponse.status,
      contentType: responseHeader(browserGetResponse, "content-type"),
      allowOrigin
    },
    latest: {
      version: latest.version,
      fileName: latest.fileName,
      downloadUrl: latest.downloadUrl
    },
    downloadHead: {
      url: latest.downloadUrl,
      status: downloadHeadResponse.status,
      contentType: responseHeader(downloadHeadResponse, "content-type")
    }
  };
}
