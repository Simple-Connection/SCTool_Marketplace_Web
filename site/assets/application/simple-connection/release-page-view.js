import { ReleaseCatalogError } from "./release-catalog-client.js";
import { buildReleaseViewModel } from "./release-view-model.js";

function requiredNode(documentRef, selector) {
  const node = documentRef?.querySelector?.(selector);
  if (!node) throw new Error("Simple Connection release page mount is missing: " + selector);
  return node;
}

export function createReleasePageView({ documentRef = globalThis.document } = {}) {
  const status = requiredNode(documentRef, "#release-status");
  const statusTitle = status.querySelector("strong");
  const statusCopy = status.querySelector("p");
  if (!statusTitle || !statusCopy) {
    throw new Error("Simple Connection release status mount is incomplete.");
  }

  const latestPanel = requiredNode(documentRef, "#latest-release");
  const latestVersion = requiredNode(documentRef, "#latest-version");
  const latestMeta = requiredNode(documentRef, "#latest-meta");
  const latestDownload = requiredNode(documentRef, "#latest-download");
  const tableWrap = requiredNode(documentRef, "#release-table-wrap");
  const tableBody = requiredNode(documentRef, "#release-table-body");
  const emptyState = requiredNode(documentRef, "#release-empty");

  function setStatus(kind, title, copy) {
    status.className = "status-card status-" + kind;
    statusTitle.textContent = title;
    statusCopy.textContent = copy;
  }

  function clearRows() {
    while (tableBody.firstChild) tableBody.firstChild.remove();
  }

  function downloadLink(row, label = "Download") {
    const link = documentRef.createElement("a");
    link.className = "download-link";
    link.href = row.downloadUrl;
    link.rel = "noreferrer";
    link.textContent = label;
    return link;
  }

  function renderTable(rows) {
    clearRows();

    for (const release of rows) {
      const row = documentRef.createElement("tr");

      const version = documentRef.createElement("td");
      version.textContent = release.version;
      version.className = "release-version";

      const state = documentRef.createElement("td");
      const badge = documentRef.createElement("span");
      badge.className = "release-state " + (release.latest ? "latest" : "previous");
      badge.textContent = release.status;
      state.append(badge);

      const platform = documentRef.createElement("td");
      platform.textContent = release.platformLabel;

      const date = documentRef.createElement("td");
      date.textContent = release.releaseDate;

      const file = documentRef.createElement("td");
      const fileName = documentRef.createElement("span");
      fileName.textContent = release.fileName;
      file.append(fileName);
      if (release.sizeLabel) {
        const size = documentRef.createElement("small");
        size.textContent = release.sizeLabel;
        file.append(size);
      }

      const action = documentRef.createElement("td");
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

  return { renderCatalog, renderFailure };
}
