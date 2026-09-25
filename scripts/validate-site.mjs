import { access, readFile } from "node:fs/promises";

const required = [
  "site/index.html",
  "site/marketplace/index.html",
  "site/application/simple_connection/downloads/index.html",
  "site/settings/index.html",
  "site/settings/my-sctool/index.html",
  "site/settings/preferences/index.html",
  "site/assets/shared/shell.css",
  "site/assets/shared/shell.js",
  "site/assets/shared/navigation.js",
  "site/assets/shared/search.js",
  "site/assets/shared/account.js",
  "site/assets/dashboard/dashboard.js",
  "site/assets/dashboard/categories.js",
  "site/assets/dashboard/dashboard.css",
  "site/assets/marketplace/marketplace.js",
  "site/assets/marketplace/drawer.js",
  "site/assets/marketplace/marketplace.css",
  "site/assets/registry-client.js",
  "site/assets/application/simple-connection/release-catalog-client.js",
  "site/assets/application/simple-connection/release-view-model.js",
  "site/assets/application/simple-connection/release-page-view.js",
  "site/assets/application/simple-connection/downloads.js",
  "site/assets/application/simple-connection/downloads.css"
];

for (const path of required) await access(path);

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const [
  dashboardHtml,
  marketplaceHtml,
  downloadsHtml,
  settingsHtml,
  marketplace,
  registryClient,
  releaseClient,
  releaseViewModel,
  releasePageView,
  downloads,
  shell,
  navigation,
  account,
  dashboard,
  dashboardCategories,
  marketplaceDrawer
] = await Promise.all([
  readFile("site/index.html", "utf8"),
  readFile("site/marketplace/index.html", "utf8"),
  readFile("site/application/simple_connection/downloads/index.html", "utf8"),
  readFile("site/settings/index.html", "utf8"),
  readFile("site/assets/marketplace/marketplace.js", "utf8"),
  readFile("site/assets/registry-client.js", "utf8"),
  readFile("site/assets/application/simple-connection/release-catalog-client.js", "utf8"),
  readFile("site/assets/application/simple-connection/release-view-model.js", "utf8"),
  readFile("site/assets/application/simple-connection/release-page-view.js", "utf8"),
  readFile("site/assets/application/simple-connection/downloads.js", "utf8"),
  readFile("site/assets/shared/shell.js", "utf8"),
  readFile("site/assets/shared/navigation.js", "utf8"),
  readFile("site/assets/shared/account.js", "utf8"),
  readFile("site/assets/dashboard/dashboard.js", "utf8"),
  readFile("site/assets/dashboard/categories.js", "utf8"),
  readFile("site/assets/marketplace/drawer.js", "utf8")
]);

const failures = [];
const require = (condition, message) => {
  if (!condition) failures.push(message);
};

for (const [label, html] of [
  ["Dashboard", dashboardHtml],
  ["Marketplace", marketplaceHtml],
  ["Simple Connection downloads", downloadsHtml],
  ["Settings", settingsHtml]
]) {
  require(html.includes("assets/shared/shell.css"), label + " must load the shared Application Shell stylesheet.");
  require(html.includes("data-global-shell"), label + " must mount the shared Application Shell.");
}

require(dashboardHtml.includes("assets/dashboard/dashboard.js"), "Dashboard must load dashboard.js.");
require(dashboardHtml.includes("dashboard-categories"), "Dashboard must expose category carousel mount.");
require(!dashboardHtml.includes("Marketplace 전체 보기"), "Dashboard must not expose a Marketplace-wide CTA; GNB owns top-level navigation.");
require(dashboard.includes('from "../registry-client.js"'), "Dashboard recommendations must consume the existing Registry client boundary.");
require(dashboard.includes("buildDashboardCategories"), "Dashboard must render through the category projection module.");
require(dashboardCategories.includes("DASHBOARD_CATEGORY_LIMIT = 10"), "Dashboard categories must be capped at ten SCTools.");
require(!dashboardCategories.includes("toLocaleLowerCase"), "Dashboard category projection must not infer semantic categories from free text.");
require(marketplaceHtml.includes("assets/marketplace/marketplace.js"), "Marketplace must load marketplace.js.");
require(marketplaceHtml.includes('id="marketplace-drawer"'), "Marketplace must own its dedicated Drawer.");
require(marketplaceHtml.includes("data-marketplace-categories"), "Marketplace Drawer must expose the category mount.");
require(!marketplaceHtml.includes("data-local-nav"), "Marketplace must not use the settings page local navigation.");
require(!downloadsHtml.includes("data-local-nav"), "Simple Connection downloads must not use the settings page local navigation.");
require(marketplaceHtml.includes('data-subnav="marketplace"'), "Marketplace must identify its download local-navigation item.");
require(downloadsHtml.includes('data-subnav="simple-connection"'), "Simple Connection must identify its download local-navigation item.");
require(downloadsHtml.includes("app-layout-wide"), "Simple Connection downloads must keep its independent page layout.");
require(settingsHtml.includes("data-local-nav"), "Settings must retain its shared local navigation.");
require(marketplace.includes('from "./drawer.js"'), "Marketplace must initialize its dedicated Drawer.");
require(marketplaceDrawer.includes('label: "번역"'), "Marketplace Drawer must expose the approved 번역 category.");
require(marketplaceDrawer.includes('label: "문서"'), "Marketplace Drawer must expose the approved 문서 category.");
require(!marketplaceDrawer.includes("filter("), "Marketplace Drawer must not infer or filter Registry categories before TAX is defined.");
require(!marketplaceDrawer.includes("details"), "Marketplace Drawer must not classify tools from Marketplace profile free text.");
require(
  downloadsHtml.includes("assets/application/simple-connection/downloads.js"),
  "Simple Connection downloads must load downloads.js."
);
require(marketplace.includes('from "../registry-client.js"'), "Marketplace must consume the existing registry-client boundary.");
require(marketplace.includes('new URL(window.location.href).searchParams.get("q")'), "Marketplace must consume Header search query q.");
require(shell.includes("initializeGlobalSearch"), "Application Shell must own the global Header search.");
require(navigation.includes('label: "대시보드"'), "GNB must expose Dashboard.");
require(navigation.includes('label: "다운로드"'), "GNB must expose Downloads.");
require(navigation.includes('label: "내설정"'), "GNB must expose Settings.");
require(navigation.includes('label: "SCTool Marketplace"'), "Download accordion must expose SCTool Marketplace.");
require(navigation.includes('label: "Simple Connection"'), "Download accordion must expose Simple Connection.");
require(navigation.includes("application/simple_connection/downloads/"), "Download accordion must link to the Simple Connection page.");
require(navigation.includes("renderDownloadNavigation"), "Shared navigation must render the download accordion Local Navigation Bar.");
require(shell.includes("data-download-local-nav"), "Application Shell must mount the download accordion Local Navigation Bar.");
require(account.includes('authState = "unconfigured"'), "GitHub account slot must remain explicitly unconfigured.");

require(
  registryClient.includes('new URL("../registry/", import.meta.url).href'),
  "Marketplace-hosted Registry base URL is missing."
);
require(
  !registryClient.includes("https://simple-connection.github.io/sctool-registry/"),
  "Legacy Registry Pages browser endpoint must not remain."
);
require(registryClient.includes("marketplaceProfiles"), "Marketplace projection must use marketplaceProfiles.");
require(registryClient.includes("snapshot.sha256"), "Snapshot digest validation must remain present.");

require(
  releaseClient.includes('https://www.kswdeveloper.cloud/application/simple_connection/releases'),
  "Simple Connection downloads must consume the exact canonical SC_Linked_App catalog URL."
);
require(
  releaseClient.includes("SIMPLE_CONNECTION_RELEASE_CATALOG_URL"),
  "Canonical Simple Connection release catalog URL must have a single explicit configuration authority."
);
require(!releaseClient.includes("window.location.origin"), "Release catalog URL must not be derived from the browser origin.");
require(!releaseClient.includes("locationRef"), "Release catalog URL must not fall back to a location-derived origin.");
require(!releaseClient.includes("RELEASES_PATH"), "Legacy SC_WEP-owned release catalog route must be removed.");
require(!releaseClient.includes("DOWNLOAD_PREFIX"), "SC_WEP must not own a release artifact path prefix.");
require(!releaseClient.includes("displayVersion"), "SC_WEP must display the canonical product version field without a duplicate displayVersion schema.");
require(!releaseClient.includes(".sort("), "Release catalog client must preserve SC_Linked_App release order.");
require(!releaseViewModel.includes(".sort("), "Release view model must preserve SC_Linked_App release order.");
require(!releasePageView.includes(".sort("), "Release page renderer must preserve SC_Linked_App release order.");
require(!downloads.includes(".sort("), "Downloads bootstrap must preserve SC_Linked_App release order.");
require(
  releaseViewModel.includes("release.latest === true"),
  "Latest/Previous UI state must use release.latest as the primary authority."
);
require(
  releasePageView.includes("row.downloadUrl") && releaseViewModel.includes("downloadUrl: release.downloadUrl"),
  "Download href must use the API downloadUrl directly."
);
require(
  downloads.includes("createReleasePageView") && downloads.includes("loadReleaseCatalog"),
  "Downloads bootstrap must only orchestrate catalog loading and page rendering."
);
require(
  releasePageView.includes("buildReleaseViewModel"),
  "Release page renderer must consume the validated release view model boundary."
);
require(
  !releasePageView.includes("updaterVersion"),
  "Release page renderer must not surface or convert updater compatibility versions."
);
require(
  !downloadsHtml.includes('application-worker-base'),
  "Simple Connection page must not configure a browser-origin release backend base."
);
require(
  !downloadsHtml.includes("Application Worker"),
  "Simple Connection presentation must not expose release infrastructure implementation details."
);
require(
  releaseClient.includes("INVALID_CONTENT_TYPE") && releaseClient.includes("isJsonContentType"),
  "Canonical release catalog success responses must require a JSON Content-Type."
);
require(
  downloadsHtml.includes("플랫폼") &&
  downloadsHtml.includes("파일 이름") &&
  downloadsHtml.includes("출시일"),
  "Release history must expose the required platform, release date, and file name columns."
);

const releaseVersionLiteral = /\b\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\b/;
require(
  !releaseVersionLiteral.test(downloadsHtml + "\n" + downloads + "\n" + releasePageView),
  "Simple Connection downloads UI must not hardcode a release version."
);

require(!marketplace.includes("simple-connection://"), "Unapproved custom install protocol must not be introduced.");
require(!downloads.includes("simple-connection://"), "Downloads UI must not introduce a custom install protocol.");
require(!dashboardHtml.includes("jekyll"), "Published site must not depend on Jekyll.");

require(!(await exists("site/assets/app.js")), "Legacy site/assets/app.js must be removed after Marketplace migration.");
require(!(await exists("site/assets/styles.css")), "Legacy site/assets/styles.css must be removed after style responsibility split.");

if (failures.length) {
  console.error("Site validation FAILED");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("Site validation PASS");
console.log("layout=multi-page-application+shared-shell");
console.log("marketplace_authority=sctool-registry");
console.log("application_release_authority=SC_Linked_App");
console.log("simple_connection_downloads=/application/simple_connection/downloads/");
console.log("registry_browser_base=marketplace-pages-relative-registry");
console.log("install_handoff=fail_closed");
