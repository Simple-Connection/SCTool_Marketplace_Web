const GLOBAL_NAVIGATION = [
  { key: "dashboard", label: "대시보드", path: "" },
  { key: "download", label: "다운로드", accordion: true },
  { key: "settings", label: "내설정", path: "settings/" }
];

const DOWNLOAD_NAVIGATION = {
  label: "다운로드",
  items: [
    { key: "marketplace", label: "SCTool Marketplace", path: "marketplace/" },
    { key: "simple-connection", label: "Simple Connection", path: "application/simple_connection/downloads/" }
  ]
};

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

function navLink(item, activeKey, className = "nav-link") {
  const link = document.createElement("a");
  link.href = siteUrl(item.path).href;
  link.textContent = item.label;
  link.className = className;
  if (item.key === activeKey) {
    link.classList.add("active");
    link.setAttribute("aria-current", "page");
  }
  return link;
}

export function renderGlobalNavigation(container, downloadPanel) {
  const section = document.body.dataset.section || "dashboard";
  container.replaceChildren();

  const nav = document.createElement("nav");
  nav.className = "gnb shell";
  nav.setAttribute("aria-label", "Global navigation");

  for (const item of GLOBAL_NAVIGATION) {
    if (item.accordion) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gnb-link gnb-button";
      button.textContent = item.label;
      button.setAttribute("aria-controls", "download-local-navigation");
      button.setAttribute("aria-expanded", section === "download" ? "true" : "false");
      if (section === item.key) button.classList.add("active");

      button.addEventListener("click", () => {
        const expanded = button.getAttribute("aria-expanded") === "true";
        button.setAttribute("aria-expanded", expanded ? "false" : "true");
        downloadPanel.hidden = expanded;
      });

      nav.append(button);
      continue;
    }

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

export function renderDownloadNavigation(container) {
  const section = document.body.dataset.section || "dashboard";
  const activeKey = document.body.dataset.subnav || "";

  container.id = "download-local-navigation";
  container.className = "download-local-navigation";
  container.hidden = section !== "download";
  container.replaceChildren();

  const inner = document.createElement("nav");
  inner.className = "shell download-local-navigation-inner";
  inner.setAttribute("aria-label", DOWNLOAD_NAVIGATION.label + " local navigation");

  for (const item of DOWNLOAD_NAVIGATION.items) {
    inner.append(navLink(item, activeKey, "download-local-link"));
  }

  container.append(inner);
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
