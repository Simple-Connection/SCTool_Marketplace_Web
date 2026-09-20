const GLOBAL_NAVIGATION = [
  { key: "dashboard", label: "대시보드", path: "" },
  { key: "download", label: "다운로드", path: "marketplace/" },
  { key: "settings", label: "내설정", path: "settings/" }
];

const LOCAL_NAVIGATION = {
  settings: {
    label: "내설정",
    items: [
      { key: "my-sctool", label: "내 SCTool", path: "settings/my-sctool/" },
      { key: "preferences", label: "설정", path: "settings/preferences/" }
    ]
  }
};

export function getSiteRootUrl() {
  const configured = document.documentElement.dataset.siteRoot || "./";
  return new URL(configured, window.location.href);
}

export function siteUrl(path = "") {
  const normalized = String(path).replace(/^\/+/, "");
  return new URL(normalized, getSiteRootUrl());
}

export function applySiteLinks(root = document) {
  for (const link of root.querySelectorAll("[data-site-path]")) {
    link.href = siteUrl(link.dataset.sitePath || "").href;
  }
}

function navLink(item, activeKey) {
  const link = document.createElement("a");
  link.href = siteUrl(item.path).href;
  link.textContent = item.label;
  link.className = "nav-link";
  if (item.key === activeKey) {
    link.classList.add("active");
    link.setAttribute("aria-current", "page");
  }
  return link;
}

export function renderGlobalNavigation(container) {
  const section = document.body.dataset.section || "dashboard";
  container.replaceChildren();

  const nav = document.createElement("nav");
  nav.className = "gnb shell";
  nav.setAttribute("aria-label", "Global navigation");

  for (const item of GLOBAL_NAVIGATION) {
    const link = document.createElement("a");
    link.href = siteUrl(item.path).href;
    link.textContent = item.label;
    link.className = "gnb-link";
    if (section === item.key) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
    nav.append(link);
  }

  container.append(nav);
}

export function renderLocalNavigation(container) {
  const section = document.body.dataset.section || "dashboard";
  const activeKey = document.body.dataset.subnav || "";
  const group = LOCAL_NAVIGATION[section];

  container.replaceChildren();
  if (!group) {
    container.hidden = true;
    document.querySelector(".app-layout")?.classList.add("app-layout-wide");
    return;
  }

  container.hidden = false;
  const title = document.createElement("p");
  title.className = "local-nav-title";
  title.textContent = group.label;

  const nav = document.createElement("nav");
  nav.className = "local-nav-links";
  nav.setAttribute("aria-label", group.label + " local navigation");

  for (const item of group.items) nav.append(navLink(item, activeKey));
  container.append(title, nav);
}
