import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CANONICAL_CATALOG_URL =
  "https://www.kswdeveloper.cloud/application/simple_connection/releases";

const SCAN_ROOTS = [
  "site/assets/application/simple-connection",
  "site/application/simple_connection/downloads",
  "scripts",
  ".github/workflows"
];

const FORBIDDEN_PATTERNS = [
  ["provider-name", /\bcloudflare\b/i],
  ["provider-cli", /\bwrangler\b/i],
  ["human-challenge", /\bturnstile\b/i],
  ["provider-header", /\bcf-[a-z0-9-]+\b/i],
  ["provider-environment", /\bCLOUDFLARE_[A-Z0-9_]*\b/i],
  ["provider-environment", /\bCF_API_[A-Z0-9_]*\b/i],
  ["provider-storage", /\bR2\b/i],
  ["provider-storage", /\bKV\s+(?:namespace|store|key)\b/i],
  ["provider-runtime", /\bApplication\s+Worker\b/i],
  ["provider-runtime", /\bworkers\.dev\b/i],
  ["provider-sdk", /@aws-sdk\b/i],
  ["provider-endpoint", /\bamazonaws\.com\b/i],
  ["provider-sdk", /@azure\//i],
  ["provider-endpoint", /\bblob\.core\.windows\.net\b/i],
  ["provider-sdk", /@google-cloud\//i],
  ["provider-endpoint", /\bstorage\.googleapis\.com\b/i]
];

const EXTERNAL_IMPORT_RE =
  /(?:from\s+|import\s*\(|require\s*\()\s*["']([^"']+)["']/g;
const ABSOLUTE_URL_RE =
  /https?:\/\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]+/g;

function normalizeRepoPath(value) {
  return String(value).replaceAll("\\", "/").replace(/^\.\//, "");
}

export function shouldScanPath(filePath) {
  const normalized = normalizeRepoPath(filePath);
  const lower = normalized.toLowerCase();

  if (
    lower.startsWith("docs/") ||
    lower.startsWith("deployment/") ||
    lower.includes("/evidence/") ||
    lower.includes("-evidence.") ||
    lower.includes("/migration/") ||
    lower.includes("/migrations/") ||
    lower.includes("/test/") ||
    lower.includes("/tests/") ||
    /(^|\/)test-[^/]+$/i.test(normalized)
  ) {
    return false;
  }

  return (
    normalized.startsWith("site/assets/application/simple-connection/") ||
    normalized.startsWith("site/application/simple_connection/downloads/") ||
    normalized === "scripts/verify-simple-connection-release-catalog.mjs" ||
    normalized.startsWith("scripts/lib/simple-connection-") ||
    normalized === ".github/workflows/jekyll.yml"
  );
}

export function findProviderIndependenceViolations(filePath, content) {
  if (!shouldScanPath(filePath)) return [];

  const violations = [];
  for (const [kind, pattern] of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      violations.push({ path: normalizeRepoPath(filePath), kind });
    }
  }

  if (/\.(?:js|mjs|cjs)$/i.test(filePath)) {
    for (const match of content.matchAll(EXTERNAL_IMPORT_RE)) {
      const specifier = match[1];
      if (
        !specifier.startsWith(".") &&
        !specifier.startsWith("/") &&
        !specifier.startsWith("node:")
      ) {
        violations.push({
          path: normalizeRepoPath(filePath),
          kind: "external-runtime-dependency",
          detail: specifier
        });
      }
    }
  }

  for (const match of content.matchAll(ABSOLUTE_URL_RE)) {
    const url = match[0];
    if (url !== CANONICAL_CATALOG_URL) {
      violations.push({
        path: normalizeRepoPath(filePath),
        kind: "hardcoded-noncanonical-endpoint",
        detail: url
      });
    }
  }

  return violations;
}

async function walk(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const child = path.join(root, entry.name);
    if (entry.isDirectory()) paths.push(...(await walk(child)));
    else if (entry.isFile()) paths.push(child);
  }
  return paths;
}

export async function validateProviderIndependence() {
  const candidates = [];
  for (const root of SCAN_ROOTS) {
    candidates.push(...(await walk(root)));
  }

  const violations = [];
  for (const filePath of candidates) {
    if (!shouldScanPath(filePath)) continue;
    const content = await readFile(filePath, "utf8");
    violations.push(...findProviderIndependenceViolations(filePath, content));
  }

  return violations;
}

const invokedDirectly =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  const violations = await validateProviderIndependence();

  if (violations.length) {
    console.error("Simple Connection provider-independence validation FAILED");
    for (const violation of violations) {
      const detail = violation.detail ? " · " + violation.detail : "";
      console.error("- " + violation.path + " · " + violation.kind + detail);
    }
    process.exit(1);
  }

  console.log("Simple Connection provider-independence validation PASS");
}
