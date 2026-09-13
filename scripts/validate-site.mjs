import { access, readFile } from "node:fs/promises";

const required = [
  "site/index.html",
  "site/assets/styles.css",
  "site/assets/app.js",
  "site/assets/registry-client.js",
];

for (const path of required) {
  await access(path);
}

const html = await readFile("site/index.html", "utf8");
const app = await readFile("site/assets/app.js", "utf8");
const client = await readFile("site/assets/registry-client.js", "utf8");

const checks = [
  [html.includes("./assets/styles.css"), "index.html must load styles.css"],
  [html.includes('type="module" src="./assets/app.js"'), "index.html must load app.js as a module"],
  [app.includes('from "./registry-client.js"'), "app.js must consume registry-client.js"],
  [client.includes('new URL("../registry/", import.meta.url).href'), "Marketplace-hosted Registry base URL is missing"],\n  [!client.includes("https://simple-connection.github.io/sctool-registry/"), "Legacy Registry Pages browser endpoint must not remain after cutover"],
  [client.includes("marketplaceProfiles"), "Marketplace projection must use marketplaceProfiles"],
  [client.includes("snapshot.sha256"), "Snapshot digest validation must remain present"],
  [!app.includes("simple-connection://"), "Unapproved custom install protocol must not be introduced"],
  [!html.includes("jekyll"), "Published site must not depend on Jekyll"],
];

const failures = checks.filter(([pass]) => !pass).map(([, message]) => message);
if (failures.length) {
  console.error("Site validation FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Site validation PASS");
console.log("authority=sctool-registry");
console.log("projection=marketplaceProfiles+packages+publishers");
console.log("install_handoff=fail_closed");
