import assert from "node:assert/strict";
import test from "node:test";
import {
  SIMPLE_CONNECTION_RELEASE_CATALOG_URL,
  ReleaseCatalogError,
  validateReleaseCatalog
} from "../site/assets/application/simple-connection/release-catalog-client.js";
import { createReleasePageView } from "../site/assets/application/simple-connection/release-page-view.js";

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parent = null;
    this.hidden = false;
    this.textContent = "";
    this.className = "";
    this.href = "";
    this.rel = "";
    this.lookup = new Map();
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }

  remove() {
    if (!this.parent) return;
    const index = this.parent.children.indexOf(this);
    if (index >= 0) this.parent.children.splice(index, 1);
    this.parent = null;
  }

  get firstChild() {
    return this.children[0] || null;
  }

  querySelector(selector) {
    return this.lookup.get(selector) || null;
  }
}

class FakeDocument {
  constructor() {
    this.nodes = new Map();
  }

  mount(selector, node) {
    this.nodes.set(selector, node);
    return node;
  }

  querySelector(selector) {
    return this.nodes.get(selector) || null;
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }
}

function sampleCatalog() {
  return validateReleaseCatalog({
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
  });
}

function pageFixture() {
  const documentRef = new FakeDocument();
  const status = documentRef.mount("#release-status", new FakeElement());
  const statusTitle = new FakeElement("strong");
  const statusCopy = new FakeElement("p");
  status.lookup.set("strong", statusTitle);
  status.lookup.set("p", statusCopy);

  const nodes = {
    status,
    statusTitle,
    statusCopy,
    latestPanel: documentRef.mount("#latest-release", new FakeElement("section")),
    latestVersion: documentRef.mount("#latest-version", new FakeElement("span")),
    latestMeta: documentRef.mount("#latest-meta", new FakeElement("p")),
    latestDownload: documentRef.mount("#latest-download", new FakeElement("a")),
    tableWrap: documentRef.mount("#release-table-wrap", new FakeElement("section")),
    tableBody: documentRef.mount("#release-table-body", new FakeElement("tbody")),
    emptyState: documentRef.mount("#release-empty", new FakeElement("section"))
  };

  return { documentRef, nodes, view: createReleasePageView({ documentRef }) };
}

test("catalog render shows Latest and Previous while preserving API order", () => {
  const { nodes, view } = pageFixture();
  view.renderCatalog(sampleCatalog());

  assert.equal(nodes.latestPanel.hidden, false);
  assert.equal(nodes.tableWrap.hidden, false);
  assert.equal(nodes.emptyState.hidden, true);
  assert.equal(nodes.latestVersion.textContent, "2.2.4a1");
  assert.equal(nodes.tableBody.children.length, 2);

  const latestRow = nodes.tableBody.children[0];
  const previousRow = nodes.tableBody.children[1];
  assert.equal(latestRow.children[0].textContent, "2.2.4a1");
  assert.equal(latestRow.children[1].children[0].textContent, "Latest");
  assert.equal(previousRow.children[0].textContent, "2.2.3");
  assert.equal(previousRow.children[1].children[0].textContent, "Previous");
});

test("rendered download href is exactly the API downloadUrl", () => {
  const catalog = sampleCatalog();
  const { nodes, view } = pageFixture();
  view.renderCatalog(catalog);

  assert.equal(nodes.latestDownload.href, catalog.releases[0].downloadUrl);
  assert.equal(nodes.tableBody.children[0].children[5].children[0].href, catalog.releases[0].downloadUrl);
  assert.equal(nodes.tableBody.children[1].children[5].children[0].href, catalog.releases[1].downloadUrl);
});

test("404 failure renders a visible endpoint error with canonical URL and status", () => {
  const { nodes, view } = pageFixture();
  view.renderFailure(new ReleaseCatalogError(
    "CATALOG_NOT_FOUND",
    "Release catalog endpoint를 찾을 수 없습니다.",
    { url: SIMPLE_CONNECTION_RELEASE_CATALOG_URL, status: 404, responseBody: '{"error":"not_found"}' }
  ));

  assert.equal(nodes.status.className, "status-card status-error");
  assert.match(nodes.statusCopy.textContent, /CATALOG_NOT_FOUND/);
  assert.match(nodes.statusCopy.textContent, /HTTP 404/);
  assert.match(nodes.statusCopy.textContent, new RegExp(SIMPLE_CONNECTION_RELEASE_CATALOG_URL.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&")));
  assert.equal(nodes.latestPanel.hidden, true);
  assert.equal(nodes.tableWrap.hidden, true);
});

test("403 failure renders a distinct visible access error", () => {
  const { nodes, view } = pageFixture();
  view.renderFailure(new ReleaseCatalogError(
    "CATALOG_ACCESS_DENIED",
    "Release catalog 접근이 거부되었습니다.",
    { url: SIMPLE_CONNECTION_RELEASE_CATALOG_URL, status: 403, responseBody: '{"error":"forbidden"}' }
  ));

  assert.match(nodes.statusCopy.textContent, /CATALOG_ACCESS_DENIED/);
  assert.match(nodes.statusCopy.textContent, /HTTP 403/);
});

test("empty releases render the explicit empty release state", () => {
  const catalog = sampleCatalog();
  catalog.releases = [];
  const { nodes, view } = pageFixture();
  view.renderCatalog(catalog);

  assert.equal(nodes.latestPanel.hidden, true);
  assert.equal(nodes.tableWrap.hidden, true);
  assert.equal(nodes.emptyState.hidden, false);
  assert.equal(nodes.tableBody.children.length, 0);
});
