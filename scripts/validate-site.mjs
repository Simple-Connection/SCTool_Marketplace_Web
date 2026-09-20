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
require(!marketplaceHtml.includes("data-local-nav"), "Marketplace must not use the shared local navigation.");
require(!downloadsHtml.includes("data-local-nav"), "Simple Connection downloads must not use the shared local navigation.");
require(downloadsHtml.includes("app-layout-wide"), "Simple Connection downloads must use an independent wide layout.");
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
require(!navigation.includes('label: "SCTool 도구"'), "Shared navigation must not own a Marketplace download LNB.");
require(!navigation.includes('label: "Simple Connection"'), "Shared navigation must not own a Simple Connection download LNB.");
require(!navigation.includes("application/simple_connection/downloads/"), "Simple Connection must not be represented through the shared download LNB.");
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
  releaseClient.includes('RELEASES_PATH = "/application/simple_connection/update/desktop/win/x64/releases"'),
  "Application Worker releases endpoint contract is missing."
);
require(releaseClient.includes("latestMatches.length !== 1"), "Release catalog must fail closed on latestVersion mismatch.");
require(releaseClient.includes("resolved.origin !== base.origin"), "Download URLs must stay on the configured Application Worker origin.");
require(releaseClient.includes("DOWNLOAD_PREFIX"), "Download URLs must stay inside the approved update namespace.");
require(!releaseClient.includes(".sort("), "Release catalog client must not reorder Worker releases.");
require(!downloads.includes(".sort("), "Downloads UI must preserve Worker release order.");
require(
  downloads.includes("release.version === catalog.latestVersion"),
  "Latest/Previous state must be derived from the same catalog latestVersion."
);
require(
  downloadsHtml.includes('meta name="application-worker-base"'),
  "Downloads page must expose the Application Worker base configuration boundary."
);

const releaseVersionLiteral = /\b\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\b/;
require(
  !releaseVersionLiteral.test(downloadsHtml + "\n" + downloads),
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
console.log("application_release_authority=application-worker");
console.log("simple_connection_downloads=/application/simple_connection/downloads/");
console.log("registry_browser_base=marketplace-pages-relative-registry");
console.log("install_handoff=fail_closed");
