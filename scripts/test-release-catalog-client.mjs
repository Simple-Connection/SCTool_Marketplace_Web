import assert from "node:assert/strict";
import test from "node:test";
import {
  SIMPLE_CONNECTION_RELEASE_CATALOG_URL,
  ReleaseCatalogError,
  loadReleaseCatalog,
  validateReleaseCatalog
} from "../site/assets/application/simple-connection/release-catalog-client.js";

function sampleCatalog() {
  return {
    schemaVersion: 1,
    latestVersion: "2.2.4a1",
    platform: "win",
    arch: "x64",
    releases: [
      {
        version: "2.2.4a1",
        updaterVersion: "2.2.4-alpha.1",
        platform: "win",
        arch: "x64",
        channel: "stable",
        fileName: "Simple-Connection-2.2.4a1-x64.exe",
        size: 96615424,
        releasedAt: "2026-09-20T16:27:02.169Z",
        latest: true,
        downloadUrl: "https://www.kswdeveloper.cloud/application/simple_connection/update/desktop/win/x64/releases/2.2.4a1/Simple-Connection-2.2.4a1-x64.exe"
      },
      {
        version: "2.2.3",
        updaterVersion: "2.2.3",
        platform: "win",
        arch: "x64",
        channel: "stable",
        fileName: "Simple-Connection-2.2.3-x64.exe",
        size: 90000000,
        releasedAt: "2026-09-01T00:00:00Z",
        latest: false,
        downloadUrl: "https://www.kswdeveloper.cloud/application/simple_connection/update/desktop/win/x64/releases/2.2.3/Simple-Connection-2.2.3-x64.exe"
      }
    ]
  };
}

function response(status, body, headers = { "content-type": "application/json; charset=utf-8" }) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  const normalizedHeaders = new Map(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), String(value)])
  );
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return normalizedHeaders.get(String(name).toLowerCase()) ?? null;
      }
    },
    async text() {
      return text;
    }
  };
}

test("canonical catalog URL is exact and catalog 200 preserves API release order", async () => {
  let requestedUrl = "";
  const catalog = await loadReleaseCatalog({
    fetchImpl: async (url) => {
      requestedUrl = url;
      return response(200, sampleCatalog());
    }
  });

  assert.equal(
    SIMPLE_CONNECTION_RELEASE_CATALOG_URL,
    "https://www.kswdeveloper.cloud/application/simple_connection/releases"
  );
  assert.equal(requestedUrl, SIMPLE_CONNECTION_RELEASE_CATALOG_URL);
  assert.deepEqual(catalog.releases.map((release) => release.version), ["2.2.4a1", "2.2.3"]);
  assert.equal(catalog.releases[0].downloadUrl, sampleCatalog().releases[0].downloadUrl);
});

test("release.latest=true is canonical and must agree with latestVersion", () => {
  const catalog = validateReleaseCatalog(sampleCatalog());
  assert.equal(catalog.releases.find((release) => release.latest)?.version, "2.2.4a1");

  const mismatch = sampleCatalog();
  mismatch.latestVersion = "2.2.3";
  assert.throws(
    () => validateReleaseCatalog(mismatch),
    (error) => error instanceof ReleaseCatalogError && error.code === "LATEST_RELEASE_MISMATCH"
  );
});

test("catalog 404 exposes URL, status, and safe response body", async () => {
  await assert.rejects(
    () => loadReleaseCatalog({ fetchImpl: async () => response(404, { error: "not_found" }) }),
    (error) =>
      error instanceof ReleaseCatalogError &&
      error.code === "CATALOG_NOT_FOUND" &&
      error.url === SIMPLE_CONNECTION_RELEASE_CATALOG_URL &&
      error.status === 404 &&
      error.responseBody.includes("not_found")
  );
});

test("catalog 403 is a distinct access error", async () => {
  await assert.rejects(
    () => loadReleaseCatalog({ fetchImpl: async () => response(403, { error: "forbidden" }) }),
    (error) => error instanceof ReleaseCatalogError && error.code === "CATALOG_ACCESS_DENIED"
  );
});

test("catalog 5xx is a distinct server error", async () => {
  await assert.rejects(
    () => loadReleaseCatalog({ fetchImpl: async () => response(503, { error: "unavailable" }) }),
    (error) => error instanceof ReleaseCatalogError && error.code === "CATALOG_SERVER_ERROR"
  );
});

test("catalog 200 with non-JSON Content-Type is rejected before body interpretation", async () => {
  await assert.rejects(
    () =>
      loadReleaseCatalog({
        fetchImpl: async () =>
          response(
            200,
            "<!doctype html><title>interstitial</title>",
            { "content-type": "text/html; charset=utf-8" }
          )
      }),
    (error) => error instanceof ReleaseCatalogError && error.code === "INVALID_CONTENT_TYPE"
  );
});

test("catalog 200 accepts structured JSON media types", async () => {
  const catalog = await loadReleaseCatalog({
    fetchImpl: async () =>
      response(200, sampleCatalog(), { "content-type": "application/vnd.simple-connection+json" })
  });

  assert.equal(catalog.latestVersion, "2.2.4a1");
});

test("invalid JSON is reported separately", async () => {
  await assert.rejects(
    () => loadReleaseCatalog({ fetchImpl: async () => response(200, "{invalid-json") }),
    (error) => error instanceof ReleaseCatalogError && error.code === "INVALID_JSON"
  );
});

test("unsupported schemaVersion is rejected without guessing", () => {
  const payload = sampleCatalog();
  payload.schemaVersion = 2;
  assert.throws(
    () => validateReleaseCatalog(payload),
    (error) => error instanceof ReleaseCatalogError && error.code === "UNSUPPORTED_SCHEMA_VERSION"
  );
});

test("empty releases are a valid empty catalog state", () => {
  const payload = sampleCatalog();
  payload.releases = [];
  const catalog = validateReleaseCatalog(payload);
  assert.deepEqual(catalog.releases, []);
});
