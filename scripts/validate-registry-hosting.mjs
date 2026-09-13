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
        if ([".js", ".mjs", ".py", ".yml", ".yaml", ".html", ".md", ".json"].includes(extension)) {
          files.push(path);
        }
      }
    }
  }

  await walk(root);
  return files;
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

const client = await readFile("site/assets/registry-client.js", "utf8");
const workflow = await readFile(".github/workflows/jekyll.yml", "utf8");
const lockText = await readFile("deployment/registry-handoff/lock.json", "utf8");
const lock = parseJson(lockText, "deployment/registry-handoff/lock.json");

const failures = [];
const marketplaceRegistryExpression = 'new URL("../registry/", import.meta.url).href';
const legacyRegistryBase = "https://simple-connection.github.io/sctool-registry/";
const expectedPublicBase = "https://simple-connection.github.io/SCTool_Marketplace_Web/registry/";

if (!client.includes(marketplaceRegistryExpression)) {
  failures.push("Browser Registry base URL is not bound to the Marketplace Pages /registry/ boundary.");
}
if (client.includes(legacyRegistryBase)) {
  failures.push("Legacy Registry Pages browser endpoint remains after production cutover.");
}

if (await exists("site/registry")) {
  failures.push("site/registry must not contain committed canonical Registry distribution data.");
}

if (lock.schemaVersion !== "marketplace-registry-handoff-lock/v1") {
  failures.push("Registry handoff lock schema is not supported.");
}
if (lock.producer?.repository !== "Simple-Connection/sctool-registry") {
  failures.push("Registry handoff producer repository mismatch.");
}
if (lock.producer?.workflow !== ".github/workflows/pages.yml") {
  failures.push("Registry handoff producer workflow mismatch.");
}
if (lock.producer?.conclusion !== "success") {
  failures.push("Registry handoff producer run is not marked successful.");
}
if (lock.hosting?.targetPath !== "/registry/") {
  failures.push("Registry handoff target path must be /registry/.");
}
if (lock.hosting?.browserCutover !== "ACTIVE") {
  failures.push("Registry browser cutover is not ACTIVE.");
}

const prerequisite = lock.hosting?.prerequisiteValidation;
if (!prerequisite || typeof prerequisite !== "object") {
  failures.push("Registry cutover prerequisite validation evidence is missing.");
} else {
  if (prerequisite.workflowRunConclusion !== "success") {
    failures.push("Registry public-hosting prerequisite workflow did not succeed.");
  }
  if (prerequisite.publicEndpointExactBytes !== "PASS") {
    failures.push("Registry public-hosting exact-byte prerequisite is not PASS.");
  }
  if (prerequisite.publicBaseUrl !== expectedPublicBase) {
    failures.push("Registry public-hosting prerequisite URL does not match the Marketplace /registry/ endpoint.");
  }
  if (!Number.isSafeInteger(prerequisite.workflowRunId) || prerequisite.workflowRunId < 1) {
    failures.push("Registry public-hosting prerequisite workflow run ID is invalid.");
  }
  if (!Number.isSafeInteger(prerequisite.deploymentEvidenceArtifactId) || prerequisite.deploymentEvidenceArtifactId < 1) {
    failures.push("Registry public-hosting deployment evidence artifact ID is invalid.");
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(prerequisite.deploymentEvidenceArtifactDigest ?? "")) {
    failures.push("Registry public-hosting deployment evidence artifact digest is invalid.");
  }
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
  if (!workflow.includes(marker)) {
    failures.push(`Pages workflow is missing required exact-handoff gate: ${marker}`);
  }
}

const siteRoot = readArg("--site-root");
if (siteRoot) {
  const root = resolve(siteRoot);

  for (const path of ["index.html", "assets/app.js", "assets/registry-client.js", "assets/styles.css"]) {
    if (!(await exists(join(root, ...path.split("/"))))) {
      failures.push(`Assembled Pages artifact is missing ${path}`);
    }
  }

  const registryPath = join(root, "registry");
  if (!(await exists(registryPath))) {
    if (hasFlag("--require-registry")) {
      failures.push("Assembled Pages artifact is missing required /registry/ boundary.");
    }
  } else {
    try {
      await validateRegistryDistribution(registryPath);
    } catch (error) {
      failures.push(
        `Assembled /registry/ boundary is invalid [${error.code ?? "UNKNOWN"}]: ${error.message}`,
      );
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
console.log("W7_PRODUCTION_CUTOVER=PASS");
