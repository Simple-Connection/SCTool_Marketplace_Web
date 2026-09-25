import assert from "node:assert/strict";
import test from "node:test";
import {
  findProviderIndependenceViolations,
  shouldScanPath
} from "./validate-simple-connection-provider-independence.mjs";

const runtimePath =
  "site/assets/application/simple-connection/release-catalog-client.js";

test("release runtime rejects provider-specific SDK and configuration markers", () => {
  const source = [
    'import x from "@aws-sdk/client-s3";',
    'const token = process.env.CLOUDFLARE_API_TOKEN;',
    'const header = "cf-ray";',
    'const bucket = "R2";'
  ].join("\n");

  const violations = findProviderIndependenceViolations(runtimePath, source);
  const kinds = new Set(violations.map((violation) => violation.kind));

  assert.equal(kinds.has("provider-sdk"), true);
  assert.equal(kinds.has("provider-environment"), true);
  assert.equal(kinds.has("provider-header"), true);
  assert.equal(kinds.has("provider-storage"), true);
  assert.equal(kinds.has("external-runtime-dependency"), true);
});

test("release runtime rejects a hardcoded fallback endpoint", () => {
  const violations = findProviderIndependenceViolations(
    runtimePath,
    'const fallback = "https://example.invalid/releases";'
  );

  assert.deepEqual(
    violations.map((violation) => violation.kind),
    ["hardcoded-noncanonical-endpoint"]
  );
});

test("the canonical SC_Linked_App catalog URL remains allowed", () => {
  const violations = findProviderIndependenceViolations(
    runtimePath,
    'const url = "https://www.kswdeveloper.cloud/application/simple_connection/releases";'
  );

  assert.deepEqual(violations, []);
});

test("short unrelated r2 text does not trigger the R2 provider rule", () => {
  const violations = findProviderIndependenceViolations(
    runtimePath,
    'const robot = "r2d2";'
  );

  assert.deepEqual(violations, []);
});

test("policy, evidence, migration, and tests are excluded from runtime scanning", () => {
  assert.equal(
    shouldScanPath("docs/policy/integration/simple_connection_release_public_access.md"),
    false
  );
  assert.equal(
    shouldScanPath("deployment/evidence/simple-connection-release-evidence.json"),
    false
  );
  assert.equal(
    shouldScanPath("scripts/migrations/release-provider-note.mjs"),
    false
  );
  assert.equal(
    shouldScanPath("scripts/test-simple-connection-provider-independence.mjs"),
    false
  );
  assert.equal(shouldScanPath(runtimePath), true);
});
