import {
  ReleaseCatalogError,
  loadReleaseCatalog
} from "./release-catalog-client.js";
import { initializeShell } from "../../shared/shell.js";

initializeShell();

const status = document.querySelector("#release-status");
const latestPanel = document.querySelector("#latest-release");
const latestVersion = document.querySelector("#latest-version");
const latestMeta = document.querySelector("#latest-meta");
const latestDownload = document.querySelector("#latest-download");
const tableWrap = document.querySelector("#release-table-wrap");
const tableBody = document.querySelector("#release-table-body");

function setStatus(kind, title, copy) {
  status.className = "status-card status-" + kind;
  status.querySelector("strong").textContent = title;
  status.querySelector("p").textContent = copy;
}

function formatDate(value) {
  const exactDate = /^\d{4}-\d{2}-\d{2}/.exec(value);
  return exactDate ? exactDate[0] : value;
}

function formatBytes(value) {
  if (value < 1024) return String(value) + " B";
  const units = ["KB", "MB", "GB"];
  let size = value / 1024;
  let unit = units[0];
  for (let i = 1; i < units.length && size >= 1024; i += 1) {
    size /= 1024;
    unit = units[i];
  }
  return (size >= 10 ? size.toFixed(0) : size.toFixed(1)) + " " + unit;
}

function clearRows() {
  while (tableBody.firstChild) tableBody.firstChild.remove();
}

function downloadLink(release, label = "Download") {
  const link = document.createElement("a");
  link.className = "download-link";
  link.href = release.resolvedDownloadUrl;
  link.rel = "noreferrer";
  link.textContent = label;
  return link;
}

function renderTable(catalog) {
  clearRows();
  for (const release of catalog.releases) {
    const row = document.createElement("tr");

    const version = document.createElement("td");
    version.textContent = release.displayVersion;
    version.className = "release-version";

    const state = document.createElement("td");
    const badge = document.createElement("span");
    const latest = release.version === catalog.latestVersion;
    badge.className = "release-state " + (latest ? "latest" : "previous");
    badge.textContent = latest ? "Latest" : "Previous";
    state.append(badge);

    const date = document.createElement("td");
    date.textContent = formatDate(release.releasedAt);

    const file = document.createElement("td");
    const platform = document.createElement("span");
    platform.textContent = "Windows x64";
    const size = document.createElement("small");
    size.textContent = formatBytes(release.size);
    file.append(platform, size);

    const action = document.createElement("td");
    action.append(downloadLink(release));

    row.append(version, state, date, file, action);
    tableBody.append(row);
  }
}

function renderCatalog(catalog) {
  const latest = catalog.releases.find((release) => release.version === catalog.latestVersion);

  latestVersion.textContent = latest.displayVersion;
  latestMeta.textContent = "Windows x64 · " + formatDate(latest.releasedAt) + " · " + formatBytes(latest.size);
  latestDownload.href = latest.resolvedDownloadUrl;
  latestDownload.rel = "noreferrer";

  renderTable(catalog);
  latestPanel.hidden = false;
  tableWrap.hidden = false;
  setStatus("ready", "Release catalog 연결됨", String(catalog.releases.length) + "개 릴리스를 Application Worker에서 불러왔습니다.");
}

function renderFailure(error) {
  latestPanel.hidden = true;
  tableWrap.hidden = true;
  clearRows();

  const known = error instanceof ReleaseCatalogError;
  const code = known ? error.code : "UNKNOWN";
  const message = known ? error.message : "Release catalog를 불러오는 중 오류가 발생했습니다.";
  setStatus("error", "Simple Connection 다운로드 정보를 불러올 수 없습니다.", message + " [" + code + "]");
}

async function initialize() {
  try {
    renderCatalog(await loadReleaseCatalog());
  } catch (error) {
    renderFailure(error);
  }
}

void initialize();
