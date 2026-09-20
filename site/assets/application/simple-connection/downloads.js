import {
  ReleaseCatalogError,
  loadReleaseCatalog
} from "./release-catalog-client.js";
import { buildReleaseViewModel } from "./release-view-model.js";
import { initializeShell } from "../../shared/shell.js";

initializeShell();

const status = document.querySelector("#release-status");
const latestPanel = document.querySelector("#latest-release");
const latestVersion = document.querySelector("#latest-version");
const latestMeta = document.querySelector("#latest-meta");
const latestDownload = document.querySelector("#latest-download");
const tableWrap = document.querySelector("#release-table-wrap");
const tableBody = document.querySelector("#release-table-body");
const emptyState = document.querySelector("#release-empty");

function setStatus(kind, title, copy) {
  status.className = "status-card status-" + kind;
  status.querySelector("strong").textContent = title;
  status.querySelector("p").textContent = copy;
}

function clearRows() {
  while (tableBody.firstChild) tableBody.firstChild.remove();
}

function downloadLink(row, label = "Download") {
  const link = document.createElement("a");
  link.className = "download-link";
  link.href = row.downloadUrl;
  link.rel = "noreferrer";
  link.textContent = label;
  return link;
}

function renderTable(rows) {
  clearRows();

  for (const release of rows) {
    const row = document.createElement("tr");

    const version = document.createElement("td");
    version.textContent = release.version;
    version.className = "release-version";

    const state = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "release-state " + (release.latest ? "latest" : "previous");
    badge.textContent = release.status;
    state.append(badge);

    const platform = document.createElement("td");
    platform.textContent = release.platformLabel;

    const date = document.createElement("td");
    date.textContent = release.releaseDate;

    const file = document.createElement("td");
    const fileName = document.createElement("span");
    fileName.textContent = release.fileName;
    file.append(fileName);
    if (release.sizeLabel) {
      const size = document.createElement("small");
      size.textContent = release.sizeLabel;
      file.append(size);
    }

    const action = document.createElement("td");
    action.append(downloadLink(release));

    row.append(version, state, platform, date, file, action);
    tableBody.append(row);
  }
}

function renderCatalog(catalog) {
  const view = buildReleaseViewModel(catalog);
  clearRows();

  if (view.empty) {
    latestPanel.hidden = true;
    tableWrap.hidden = true;
    emptyState.hidden = false;
    setStatus("ready", "Release catalog 연결됨", "현재 공개된 Simple Connection release가 없습니다.");
    return;
  }

  emptyState.hidden = true;
  const latest = view.latest;
  latestVersion.textContent = latest.version;
  latestMeta.textContent = [
    latest.platformLabel,
    latest.releaseDate,
    latest.fileName,
    latest.sizeLabel
  ].filter(Boolean).join(" · ");
  latestDownload.href = latest.downloadUrl;
  latestDownload.rel = "noreferrer";

  renderTable(view.rows);
  latestPanel.hidden = false;
  tableWrap.hidden = false;
  setStatus(
    "ready",
    "Release catalog 연결됨",
    String(view.rows.length) + "개 릴리스를 SC_Linked_App canonical API에서 불러왔습니다."
  );
}

function renderFailure(error) {
  latestPanel.hidden = true;
  tableWrap.hidden = true;
  emptyState.hidden = true;
  clearRows();

  const known = error instanceof ReleaseCatalogError;
  const code = known ? error.code : "UNKNOWN";
  const message = known
    ? error.diagnosticText()
    : "Release catalog를 불러오는 중 알 수 없는 오류가 발생했습니다.";

  setStatus(
    "error",
    "Simple Connection 다운로드 정보를 불러올 수 없습니다.",
    message + " [" + code + "]"
  );
}

async function initialize() {
  try {
    renderCatalog(await loadReleaseCatalog());
  } catch (error) {
    renderFailure(error);
  }
}

void initialize();
