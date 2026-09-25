import assert from "node:assert/strict";
import test from "node:test";
import { ReleaseCatalogError } from "../site/assets/application/simple-connection/release-catalog-client.js";
import { verifySimpleConnectionPublicRelease } from "./lib/simple-connection-public-release.mjs";

const CATALOG_URL = "https://www.kswdeveloper.cloud/application/simple_connection/releases";
const CONSUMER_URL = "https://simple-connection.github.io/SCTool_Marketplace_Web/";
const CONSUMER_ORIGIN = "https://simple-connection.github.io";
const DOWNLOAD_URL =
  "https://www.kswdeveloper.cloud/application/simple_connection/update/desktop/win/x64/releases/2.2.4a1/Simple-Connection-2.2.4a1-x64.exe";

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
        downloadUrl: DOWNLOAD_URL
      }
    ]
  };
}

function response(status, body = "", headers = {}) {
  const normalized = new Map(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), String(value)])
  );
  const text = typeof body === "string" ? body : JSON.stringify(body);

  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return normalized.get(String(name).toLowerCase()) ?? null;
      }
    },
    async text() {
      return text;
    }
  };
}

function successFetch(requests, {
  allowOrigin = CONSUMER_ORIGIN,
  downloadStatus = 200,
  catalogHeadStatus = 200
} = {}) {
  return async (url, options = {}) => {
    const method = options.method || "GET";
    requests.push({ url, method, headers: options.headers || {} });

    if (url === CATALOG_URL && method === "HEAD") {
      return response(catalogHeadStatus, "", {
        "content-type": "application/json; charset=utf-8"
      });
    }

    if (url === CATALOG_URL && method === "GET") {
      const headers = { "content-type": "application/json; charset=utf-8" };
      if (allowOrigin !== null) headers["access-control-allow-origin"] = allowOrigin;
      return response(200, sampleCatalog(), headers);
    }

    if (url === DOWNLOAD_URL && method === "HEAD") {
      return response(downloadStatus, "", {
        "content-type": "application/vnd.microsoft.portable-executable"
      });
    }

    throw new Error("Unexpected request: " + method + " " + url);
  };
}

test("public release boundary validates HEAD, browser CORS GET, and exact downloadUrl HEAD", async () => {
  const requests = [];
  const evidence = await verifySimpleConnectionPublicRelease({
    consumerUrl: CONSUMER_URL,
    fetchImpl: successFetch(requests)
  });

  assert.equal(evidence.catalogUrl, CATALOG_URL);
  assert.equal(evidence.consumerOrigin, CONSUMER_ORIGIN);
  assert.equal(evidence.latestVersion, "2.2.4a1");
  assert.equal(evidence.latest.downloadUrl, DOWNLOAD_URL);
  assert.equal(evidence.catalogHead.status, 200);
  assert.equal(evidence.browserCatalogGet.allowOrigin, CONSUMER_ORIGIN);
  assert.equal(evidence.downloadHead.url, DOWNLOAD_URL);
  assert.equal(evidence.downloadHead.status, 200);

  const browserGet = requests.find(
    (request) => request.url === CATALOG_URL && request.method === "GET"
  );
  assert.equal(browserGet.headers.Origin, CONSUMER_ORIGIN);
  assert.deepEqual(
    requests.map((request) => [request.method, request.url]),
    [
      ["HEAD", CATALOG_URL],
      ["GET", CATALOG_URL],
      ["HEAD", DOWNLOAD_URL]
    ]
  );
});

test("catalog HEAD 403 remains a verification failure", async () => {
  const requests = [];
  await assert.rejects(
    () =>
      verifySimpleConnectionPublicRelease({
        consumerUrl: CONSUMER_URL,
        fetchImpl: successFetch(requests, { catalogHeadStatus: 403 })
      }),
    (error) =>
      error instanceof ReleaseCatalogError &&
      error.code === "CATALOG_HEAD_HTTP_ERROR" &&
      error.status === 403
  );
});

test("browser cross-origin read failure is not promoted to success", async () => {
  const requests = [];
  await assert.rejects(
    () =>
      verifySimpleConnectionPublicRelease({
        consumerUrl: CONSUMER_URL,
        fetchImpl: successFetch(requests, { allowOrigin: null })
      }),
    (error) =>
      error instanceof ReleaseCatalogError &&
      error.code === "BROWSER_CORS_DENIED"
  );
});

test("browser CORS wildcard is valid for credential-free catalog reads", async () => {
  const requests = [];
  const evidence = await verifySimpleConnectionPublicRelease({
    consumerUrl: CONSUMER_URL,
    fetchImpl: successFetch(requests, { allowOrigin: "*" })
  });

  assert.equal(evidence.browserCatalogGet.allowOrigin, "*");
});

test("latest release downloadUrl HEAD failure fails the public release gate", async () => {
  const requests = [];
  await assert.rejects(
    () =>
      verifySimpleConnectionPublicRelease({
        consumerUrl: CONSUMER_URL,
        fetchImpl: successFetch(requests, { downloadStatus: 404 })
      }),
    (error) =>
      error instanceof ReleaseCatalogError &&
      error.code === "DOWNLOAD_HEAD_HTTP_ERROR" &&
      error.status === 404
  );
});
