import { MarketplaceDataError, loadMarketplace } from "../registry-client.js";
import { initializeShell } from "../shared/shell.js";
import { siteUrl } from "../shared/navigation.js";
import { buildDashboardCategories } from "./categories.js";

initializeShell();

const status = document.querySelector("#dashboard-registry-status");
const categoryRoot = document.querySelector("#dashboard-categories");
const emptyState = document.querySelector("#dashboard-empty");

function setStatus(kind, title, copy) {
  status.className = "status-card status-" + kind;
  status.querySelector("strong").textContent = title;
  status.querySelector("p").textContent = copy;
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

function marketplaceToolUrl(toolId) {
  const url = siteUrl("marketplace/");
  url.searchParams.set("tool", toolId);
  return url.href;
}

function createToolCard(item) {
  const card = document.createElement("article");
  card.className = "recommendation-card";

  const top = document.createElement("div");
  top.className = "recommendation-card-top";

  const avatar = document.createElement("span");
  avatar.className = "recommendation-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = initials(item.id);

  const version = document.createElement("span");
  version.className = "recommendation-version mono";
  version.textContent = item.version ? "v" + item.version : item.defaultChannel || "Registry";
  top.append(avatar, version);

  const title = document.createElement("h3");
  title.textContent = item.id;

  const publisher = document.createElement("p");
  publisher.className = "recommendation-publisher";
  publisher.textContent = item.publisherName || item.publisherId || "게시자 정보 없음";

  const summary = document.createElement("p");
  summary.className = "recommendation-summary";
  summary.textContent = item.profile.details;

  const link = document.createElement("a");
  link.className = "recommendation-link";
  link.href = marketplaceToolUrl(item.id);
  link.textContent = "세부정보 보기";

  card.append(top, title, publisher, summary, link);
  return card;
}

function updateCarouselButtons(scroller, previous, next) {
  const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  previous.disabled = scroller.scrollLeft <= 2;
  next.disabled = scroller.scrollLeft >= maxScroll - 2;
}

function createCarousel(category) {
  const section = document.createElement("section");
  section.className = "recommendation-section";
  section.setAttribute("aria-labelledby", "dashboard-category-" + category.key);

  const head = document.createElement("div");
  head.className = "recommendation-head";

  const copy = document.createElement("div");
  const title = document.createElement("h2");
  title.id = "dashboard-category-" + category.key;
  title.textContent = category.title;

  const description = document.createElement("p");
  description.textContent = category.description + " · 최대 10개";
  copy.append(title, description);

  const controls = document.createElement("div");
  controls.className = "carousel-controls";

  const previous = document.createElement("button");
  previous.type = "button";
  previous.className = "carousel-button";
  previous.setAttribute("aria-label", category.title + " 이전 항목");
  previous.textContent = "‹";

  const next = document.createElement("button");
  next.type = "button";
  next.className = "carousel-button";
  next.setAttribute("aria-label", category.title + " 다음 항목");
  next.textContent = "›";

  controls.append(previous, next);
  head.append(copy, controls);

  const scroller = document.createElement("div");
  scroller.className = "recommendation-carousel";
  scroller.tabIndex = 0;
  scroller.setAttribute("aria-label", category.title + " SCTool 목록");

  for (const item of category.items) scroller.append(createToolCard(item));

  const move = (direction) => {
    scroller.scrollBy({
      left: direction * Math.max(280, scroller.clientWidth * 0.8),
      behavior: "smooth"
    });
  };

  previous.addEventListener("click", () => move(-1));
  next.addEventListener("click", () => move(1));
  scroller.addEventListener("scroll", () => updateCarouselButtons(scroller, previous, next), { passive: true });
  window.addEventListener("resize", () => updateCarouselButtons(scroller, previous, next));

  section.append(head, scroller);
  requestAnimationFrame(() => updateCarouselButtons(scroller, previous, next));
  return section;
}

function renderCategories(items) {
  categoryRoot.replaceChildren();
  const categories = buildDashboardCategories(items);

  if (!categories.length) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  for (const category of categories) categoryRoot.append(createCarousel(category));
}

async function initialize() {
  try {
    const result = await loadMarketplace();
    renderCategories(result.items);

    setStatus(
      "ready",
      "추천 SCTool 준비됨",
      result.items.length
        ? String(result.items.length) + "개 Marketplace SCTool에서 카테고리별 목록을 구성했습니다."
        : "현재 Registry snapshot에는 표시 가능한 Marketplace SCTool이 없습니다."
    );
  } catch (error) {
    const known = error instanceof MarketplaceDataError;
    const code = known ? error.code : "UNKNOWN";
    const message = known ? error.message : "추천 SCTool 데이터를 불러오는 중 오류가 발생했습니다.";
    categoryRoot.replaceChildren();
    emptyState.hidden = false;
    setStatus("error", "추천 SCTool을 불러오지 못했습니다.", message + " [" + code + "]");
  }
}

void initialize();
