import { MarketplaceDataError, loadMarketplace } from "../registry-client.js";
import { initializeShell } from "../shared/shell.js";
import { initializeMarketplaceDrawer } from "./drawer.js";

const { searchInput } = initializeShell();
initializeMarketplaceDrawer();
const toolGrid = document.querySelector("#tool-grid");
const emptyState = document.querySelector("#empty-state");
const emptyTitle = document.querySelector("#empty-title");
const emptyCopy = document.querySelector("#empty-copy");
const resultCount = document.querySelector("#result-count");
const registryStatus = document.querySelector("#registry-status");
const registryRevision = document.querySelector("#registry-revision");
const dialog = document.querySelector("#tool-dialog");
const dialogTitle = document.querySelector("#dialog-title");
const dialogPublisher = document.querySelector("#dialog-publisher");
const dialogVersion = document.querySelector("#dialog-version");
const dialogContent = document.querySelector("#dialog-content");
const dialogMeta = document.querySelector("#dialog-meta");
const detailTabs = Array.from(document.querySelectorAll(".detail-tab"));

const initialQuery = new URL(window.location.href).searchParams.get("q") || "";
searchInput.value = initialQuery;

const state = {
  items: [],
  query: initialQuery,
  selected: null,
  tab: "details",
  provenance: null
};

function normalize(value) {
  return String(value ?? "").toLocaleLowerCase();
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value < 0) return "";
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

function initials(packageId) {
  return packageId
    .split(/[-_.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .slice(0, 2) || "SC";
}

function searchableText(item) {
  return normalize([
    item.id,
    item.publisherId,
    item.publisherName,
    item.version,
    item.defaultChannel,
    item.profile.details,
    item.profile.features,
    item.profile.changelog,
    item.profile.dependencies,
    item.profile.extension_pack
  ].join(" "));
}

function filteredItems() {
  const query = normalize(state.query.trim());
  if (!query) return state.items;
  return state.items.filter((item) => searchableText(item).includes(query));
}

function setStatus(kind, title, copy) {
  registryStatus.className = "status-card status-" + kind;
  registryStatus.querySelector("strong").textContent = title;
  registryStatus.querySelector("p").textContent = copy;
}

function clearChildren(node) {
  while (node.firstChild) node.firstChild.remove();
}

function createCard(item) {
  const card = document.createElement("article");
  card.className = "tool-card";

  const top = document.createElement("div");
  top.className = "tool-card-top";

  const avatar = document.createElement("div");
  avatar.className = "tool-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = initials(item.id);

  const version = document.createElement("span");
  version.className = "tool-version mono";
  version.textContent = item.version
    ? (item.defaultChannel || "channel") + " · v" + item.version
    : item.defaultChannel || "Registry";

  top.append(avatar, version);

  const title = document.createElement("h3");
  title.textContent = item.id;

  const publisher = document.createElement("p");
  publisher.className = "tool-publisher";
  publisher.textContent = item.publisherName ? "게시자 · " + item.publisherName : "게시자 정보 없음";

  const summary = document.createElement("p");
  summary.className = "tool-summary";
  summary.textContent = item.profile.details;

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "세부정보 보기";
  button.addEventListener("click", () => openDetail(item));

  card.append(top, title, publisher, summary, button);
  return card;
}

function renderList() {
  const items = filteredItems();
  clearChildren(toolGrid);

  resultCount.textContent = state.items.length
    ? state.query.trim()
      ? String(items.length) + " / " + String(state.items.length) + "개"
      : String(state.items.length) + "개"
    : "";

  if (!items.length) {
    toolGrid.hidden = true;
    emptyState.hidden = false;

    if (state.query.trim() && state.items.length) {
      emptyTitle.textContent = "검색 결과가 없습니다.";
      emptyCopy.textContent = "“" + state.query.trim() + "”에 해당하는 Marketplace SCTool을 찾지 못했습니다.";
    } else {
      emptyTitle.textContent = "표시할 Marketplace SCTool이 없습니다.";
      emptyCopy.textContent = "Registry에 Marketplace profile이 게시되면 이 목록에 자동으로 표시됩니다.";
    }
    return;
  }

  emptyState.hidden = true;
  toolGrid.hidden = false;
  for (const item of items) toolGrid.append(createCard(item));
}

function updateQueryUrl() {
  const url = new URL(window.location.href);
  if (state.query.trim()) url.searchParams.set("q", state.query.trim());
  else url.searchParams.delete("q");
  history.replaceState(history.state, "", url);
}

function addMeta(label, value, href = "") {
  if (!value) return;
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");

  if (href) {
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = value;
    dd.append(link);
  } else {
    dd.textContent = value;
  }

  dialogMeta.append(dt, dd);
}

function renderDetailMeta(item) {
  clearChildren(dialogMeta);
  addMeta("Package ID", item.id);
  addMeta("게시자", item.publisherName || item.publisherId);
  addMeta("기본 채널", item.defaultChannel);
  addMeta("현재 버전", item.version ? "v" + item.version : "");
  addMeta("소스 공개 상태", item.sourceVisibility);
  addMeta("소스 저장소", item.sourceRepository, item.sourceRepository);

  if (item.artifacts.length) {
    addMeta(
      "Artifact",
      item.artifacts
        .map((artifact) => [artifact.target, artifact.filename, formatBytes(artifact.size)].filter(Boolean).join(" · "))
        .join(" / ")
    );
  }
}

function availableTabs(item) {
  return {
    details: item.profile.details,
    features: item.profile.features,
    changelog: item.profile.changelog,
    dependencies: item.profile.dependencies,
    extension_pack: item.profile.extension_pack
  };
}

function selectTab(tab) {
  if (!state.selected) return;
  const tabs = availableTabs(state.selected);
  if (!Object.hasOwn(tabs, tab) || !tabs[tab]) tab = "details";
  state.tab = tab;

  for (const button of detailTabs) {
    const key = button.dataset.tab;
    if (button.classList.contains("optional-tab")) button.hidden = !tabs[key];
    button.classList.toggle("active", key === tab);
    button.setAttribute("aria-selected", key === tab ? "true" : "false");
  }

  dialogContent.textContent = tabs[tab] || "";
}

function openDetail(item, { updateUrl = true } = {}) {
  state.selected = item;
  dialogTitle.textContent = item.id;
  dialogPublisher.textContent = item.publisherName || item.publisherId || "SCTOOL";
  dialogVersion.textContent = item.version
    ? (item.defaultChannel || "Registry") + " · v" + item.version
    : item.defaultChannel || "Registry package";
  renderDetailMeta(item);
  selectTab("details");

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("tool", item.id);
    history.pushState({ tool: item.id }, "", url);
  }

  if (!dialog.open) dialog.showModal();
}

function closeDetail({ updateUrl = true } = {}) {
  if (dialog.open) dialog.close();
  state.selected = null;
  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.delete("tool");
    history.pushState({}, "", url);
  }
}

function openFromUrl() {
  const id = new URL(window.location.href).searchParams.get("tool");
  if (!id) {
    if (dialog.open) dialog.close();
    state.selected = null;
    return;
  }
  const item = state.items.find((candidate) => candidate.id === id);
  if (item) openDetail(item, { updateUrl: false });
}

searchInput.addEventListener("input", () => {
  state.query = searchInput.value;
  updateQueryUrl();
  renderList();
});

for (const button of detailTabs) {
  button.addEventListener("click", () => selectTab(button.dataset.tab));
}

dialog.addEventListener("close", () => {
  if (state.selected) closeDetail();
});

dialog.addEventListener("click", (event) => {
  if (event.target === dialog) closeDetail();
});

window.addEventListener("popstate", () => {
  state.query = new URL(window.location.href).searchParams.get("q") || "";
  searchInput.value = state.query;
  renderList();
  openFromUrl();
});

async function initialize() {
  try {
    const result = await loadMarketplace();
    state.items = result.items;
    state.provenance = result.provenance;

    if (result.items.length) {
      setStatus(
        "ready",
        "Registry Marketplace 연결됨",
        result.skipped
          ? String(result.items.length) + "개 도구를 표시합니다. 계약을 충족하지 못한 profile " + String(result.skipped) + "개는 표시하지 않았습니다."
          : String(result.items.length) + "개 Marketplace 도구를 Registry snapshot에서 불러왔습니다."
      );
    } else {
      setStatus("ready", "Registry 연결됨 · Marketplace 대기 중", "현재 snapshot에는 표시 가능한 Marketplace profile이 없습니다.");
    }

    registryRevision.textContent = "Registry seq " + String(result.provenance.sequence) + " · " + result.provenance.revision;
    renderList();
    openFromUrl();
  } catch (error) {
    const known = error instanceof MarketplaceDataError;
    const code = known ? error.code : "UNKNOWN";
    const message = known ? error.message : "Marketplace 데이터를 불러오는 중 오류가 발생했습니다.";

    setStatus("error", "Registry Marketplace를 불러오지 못했습니다.", message + " [" + code + "]");
    registryRevision.textContent = "Registry unavailable";
    toolGrid.hidden = true;
    emptyState.hidden = false;
    emptyTitle.textContent = "Marketplace 데이터 대기 중";
    emptyCopy.textContent = "사이트 자체는 정상 배포되었습니다. Registry Marketplace snapshot이 게시되면 목록이 자동으로 나타납니다.";
  }
}

renderList();
void initialize();
