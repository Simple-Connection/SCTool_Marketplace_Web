import assert from "node:assert/strict";
import test from "node:test";
import {
  ReleaseCatalogError,
  resolveReleaseDownloadUrl,
  validateReleaseCatalog
} from "../site/assets/application/simple-connection/release-catalog-client.js";

const workerBase = "https://worker.example.test/";

function sampleCatalog() {
  return {
    latestVersion: "release-next",
    releases: [
      {
        version: "release-next",
        displayVersion: "Next",
        releasedAt: "2026-09-19T00:00:00Z",
        size: 1024,
        downloadUrl: "/application/simple_connection/update/desktop/win/x64/releases/release-next/app.exe"
      },
      {
        version: "release-prev",
        displayVersion: "Previous",
        releasedAt: "2026-09-01T00:00:00Z",
        size: 512,
        downloadUrl: "/application/simple_connection/update/desktop/win/x64/releases/release-prev/app.exe"
      }
    ]
  };
}

test("validates catalog without changing Worker release order", () => {
  const catalog = validateReleaseCatalog(sampleCatalog(), { baseUrl: workerBase });
  assert.deepEqual(catalog.releases.map((release) => release.version), ["release-next", "release-prev"]);
  assert.equal(
    catalog.releases[0].resolvedDownloadUrl,
    "https://worker.example.test/application/simple_connection/update/desktop/win/x64/releases/release-next/app.exe"
  );
});

test("fails closed when latestVersion has no exact release", () => {
  const payload = sampleCatalog();
  payload.latestVersion = "missing";
  assert.throws(
    () => validateReleaseCatalog(payload, { baseUrl: workerBase }),
    (error) => error instanceof ReleaseCatalogError && error.code === "LATEST_RELEASE_MISMATCH"
  );
});

test("rejects download URLs outside the approved update namespace", () => {
  assert.throws(
    () => resolveReleaseDownloadUrl("/other/file.exe", workerBase),
    (error) => error instanceof ReleaseCatalogError && error.code === "UNSAFE_DOWNLOAD_URL"
  );
});

test("rejects cross-origin absolute download URLs", () => {
  assert.throws(
    () => resolveReleaseDownloadUrl(
      "https://other.example.test/application/simple_connection/update/desktop/win/x64/releases/file.exe",
      workerBase
    ),
    (error) => error instanceof ReleaseCatalogError && error.code === "UNSAFE_DOWNLOAD_URL"
  );
});
