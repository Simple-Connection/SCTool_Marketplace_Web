import assert from "node:assert/strict";
import test from "node:test";
import { validateReleaseCatalog } from "../site/assets/application/simple-connection/release-catalog-client.js";
import { buildReleaseViewModel } from "../site/assets/application/simple-connection/release-view-model.js";

function catalogPayload() {
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

test("catalog 200 view model renders latest and historical releases", () => {
  const view = buildReleaseViewModel(validateReleaseCatalog(catalogPayload()));

  assert.equal(view.empty, false);
  assert.equal(view.latest.version, "2.2.4a1");
  assert.equal(view.latest.status, "Latest");
  assert.equal(view.rows[1].version, "2.2.3");
  assert.equal(view.rows[1].status, "Previous");
  assert.equal(view.rows[0].platformLabel, "Windows x64");
  assert.equal(view.rows[0].releaseDate, "2026-09-20");
  assert.equal(view.rows[0].fileName, "Simple-Connection-2.2.4a1-x64.exe");
});

test("download href remains exactly the API downloadUrl", () => {
  const payload = catalogPayload();
  const expected = payload.releases[0].downloadUrl;
  const view = buildReleaseViewModel(validateReleaseCatalog(payload));
  assert.equal(view.latest.downloadUrl, expected);
  assert.equal(view.rows[0].downloadUrl, expected);
});

test("empty releases produce an explicit empty view state", () => {
  const payload = catalogPayload();
  payload.releases = [];
  const view = buildReleaseViewModel(validateReleaseCatalog(payload));
  assert.equal(view.empty, true);
  assert.equal(view.latest, null);
  assert.deepEqual(view.rows, []);
});
