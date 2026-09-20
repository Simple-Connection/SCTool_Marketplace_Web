import { renderAccountSlot } from "./account.js";
import {
  applySiteLinks,
  renderDownloadNavigation,
  renderGlobalNavigation,
  renderLocalNavigation,
  siteUrl
} from "./navigation.js";
import { initializeGlobalSearch } from "./search.js";

let cached = null;

export function initializeShell() {
  if (cached) return cached;

  const globalSlot = document.querySelector("[data-global-shell]");
  if (!globalSlot) throw new Error("Application Shell mount is missing.");

  globalSlot.innerHTML = [
    '<a class="skip-link" href="#main-content">콘텐츠로 이동</a>',
    '<header class="site-header">',
    '  <div class="shell header-inner">',
    '    <a class="brand" data-brand-link aria-label="Simple Connection 홈">',
    '      <span class="brand-mark" aria-hidden="true">SC</span>',
    '      <span class="brand-copy"><strong>Simple Connection</strong><small>Application</small></span>',
    '    </a>',
    '    <form class="global-search" role="search">',
    '      <span class="global-search-icon" aria-hidden="true">⌕</span>',
    '      <input id="global-search-input" type="search" autocomplete="off" placeholder="SCTool 검색" aria-label="SCTool Marketplace 검색" />',
    '      <kbd>/</kbd>',
    '    </form>',
    '    <div data-account-slot></div>',
    '  </div>',
    '</header>',
    '<div class="gnb-wrap">',
    '  <div data-global-nav></div>',
    '  <div data-download-local-nav></div>',
    '</div>'
  ].join("\n");

  globalSlot.querySelector("[data-brand-link]").href = siteUrl("").href;
  const downloadPanel = globalSlot.querySelector("[data-download-local-nav]");
  renderDownloadNavigation(downloadPanel);
  renderGlobalNavigation(globalSlot.querySelector("[data-global-nav]"), downloadPanel);

  const localSlot = document.querySelector("[data-local-nav]");
  if (localSlot) renderLocalNavigation(localSlot);

  renderAccountSlot(globalSlot.querySelector("[data-account-slot]"));
  applySiteLinks(document);

  const searchForm = globalSlot.querySelector(".global-search");
  const searchInput = globalSlot.querySelector("#global-search-input");
  initializeGlobalSearch(searchForm, searchInput);

  cached = { searchForm, searchInput };
  document.dispatchEvent(new CustomEvent("application-shell-ready", { detail: cached }));
  return cached;
}
