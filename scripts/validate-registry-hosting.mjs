import { access, readFile, readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { validateRegistryDistribution } from "./lib/registry-distribution.mjs";

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function collectTextFiles(root) {
  if (!(await exists(root))) return [];
  const files = [];

  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.isFile()) {
        const extension = extname(entry.name);
        if ([".js", ".mjs", ".yml", ".yaml", ".html", ".md"].includes(extension)) files.push(path);
      }
    }
  }

  await walk(root);
  return files;
}

const client = await readFile("site/assets/registry-client.js", "utf8");
const workflow = await readFile(".github/workflows/jekyll.yml", "utf8");

const failures = [];
const currentRegistryBase = "https://simple-connection.github.io/sctool-registry/";

if (!client.includes(`REGISTRY_BASE_URL = "${currentRegistryBase}"`)) {
  failures.push("Production Registry base URL changed before approved cutover.");
}
if (await exists("site/registry")) {
  failures.push("site/registry must not contain committed canonical Registry distribution data.");
}

for (const path of await collectTextFiles("site"), ...await collectTextFiles("scripts"), ...await collectTextFiles(".github/workflows")) {
  const text = await readFile(path, "utf8");
  const forbidden = [
    "SCTOOL_REGISTRY_ROOT_PRIVATE_KEY_B64",
    "SCTOOL_REGISTRY_DISTRIBUTION_PRIVATE_KEY_B64",
    "signCanonical(",
    "createPrivateKey(",
    "crypto.sign(",
    "subtle.sign(",
  ];
  for (const marker of forbidden) {
    if (text.includes(marker)) failures.push(`${path} contains forbidden Registry signing/private-key marker: ${marker}`);
  }
}

for (const marker of [
  "node --test scripts/test-registry-hosting.mjs",
  "node scripts/prepare-pages.mjs --out _site",
  "node scripts/validate-registry-hosting.mjs --site-root _site",
  "path: ./_site",
]) {
  if (!workflow.includes(marker)) failures.push(`Pages workflow is missing required Phase 1 gate: ${marker}`);
}

const siteRoot = readArg("--site-root");
if (siteRoot) {
  const root = resolve(siteRoot);
  for (const path of ["index.html", "assets/app.js", "assets/registry-client.js", "assets/styles.css"]) {
    if (!(await exists(join(root, ...path.split("/"))))) failures.push(`Assembled Pages artifact is missing ${path}`);
  }
  const registryPath = join(root, "registry");
  if (await exists(registryPath)) {
    try {
      await validateRegistryDistribution(registryPath);
    } catch (error) {
      failures.push(`Assembled /registry/ boundary is invalid [${error.code ?? "UNKNOWN"}]: ${error.message}`);
    }
  }
}

if (failures.length) {
  console.error("Registry hosting boundary validation FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Registry hosting boundary validation PASS");
console.log("W1_AUTHORITY_BOUNDARY=PASS");
console.log("W2_SINGLE_PAGES_ARTIFACT_LAYOUT=PASS");
console.log("W4_PRIVATE_KEY_EXCLUSION=PASS");
console.log("W7_PRODUCTION_CUTOVER=BLOCKED_UNTIL_REGISTRY_HANDOFF");
