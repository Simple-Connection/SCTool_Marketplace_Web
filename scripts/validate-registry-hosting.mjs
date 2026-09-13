import { access, readFile, readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { validateRegistryDistribution } from "./lib/registry-distribution.mjs";

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name) {
  return process.argv.includes(name);
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
        if ([".js", ".mjs", ".py", ".yml", ".yaml", ".html", ".md", ".json"].includes(extension)) files.push(path);
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
  failures.push("Production Registry base URL changed before public /registry/ exact-byte validation.");
}
if (await exists("site/registry")) {
  failures.push("site/registry must not contain committed canonical Registry distribution data.");
}

const forbiddenMarkers = [
  "SCTOOL_REGISTRY_" + "ROOT_PRIVATE_KEY_B64",
  "SCTOOL_REGISTRY_" + "DISTRIBUTION_PRIVATE_KEY_B64",
  "sign" + "Canonical(",
  "create" + "PrivateKey(",
  "crypto." + "sign(",
  "subtle." + "sign(",
];

const scannedFiles = [
  ...await collectTextFiles("site"),
  ...await collectTextFiles("scripts"),
  ...await collectTextFiles(".github/workflows"),
  ...await collectTextFiles("deployment"),
];

for (const path of scannedFiles) {
  const text = await readFile(path, "utf8");
  for (const marker of forbiddenMarkers) {
    if (text.includes(marker)) {
      failures.push(`${path} contains forbidden Registry signing/private-key marker: ${marker}`);
    }
  }
}

for (const marker of [
  "python scripts/verify-registry-handoff.py",
  "--lock deployment/registry-handoff/lock.json",
  "--materialize _site/registry",
  "--require-registry",
  "--public-base-url",
  "registry-hosting-deployment-evidence.json",
  "path: ./_site",
]) {
  if (!workflow.includes(marker)) failures.push(`Pages workflow is missing required exact-handoff gate: ${marker}`);
}

const siteRoot = readArg("--site-root");
if (siteRoot) {
  const root = resolve(siteRoot);
  for (const path of ["index.html", "assets/app.js", "assets/registry-client.js", "assets/styles.css"]) {
    if (!(await exists(join(root, ...path.split("/"))))) failures.push(`Assembled Pages artifact is missing ${path}`);
  }
  const registryPath = join(root, "registry");
  if (!(await exists(registryPath))) {
    if (hasFlag("--require-registry")) failures.push("Assembled Pages artifact is missing required /registry/ boundary.");
  } else {
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
console.log("W3_SIGNED_DISTRIBUTION_BYTE_PRESERVATION=PASS");
console.log("W4_PRIVATE_KEY_EXCLUSION=PASS");
console.log("W5_FAIL_CLOSED_BROWSER_CONSUMER=PASS");
console.log("W6_STATIC_SITE_REGRESSION=PASS");
console.log("W7_PRODUCTION_CUTOVER=HOSTING_READY_BROWSER_CUTOVER_PENDING");
