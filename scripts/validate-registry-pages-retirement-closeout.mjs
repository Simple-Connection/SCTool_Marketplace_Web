import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const closeoutPath = "deployment/registry-handoff/closeout/registry-pages-retirement-closeout.json";
const evidencePath = "deployment/registry-handoff/closeout/registry-hosting-deployment-evidence.json";
const lockPath = "deployment/registry-handoff/lock.json";
const clientPath = "site/assets/registry-client.js";

const [closeoutBytes, evidenceBytes, lockBytes, client] = await Promise.all([
  readFile(closeoutPath),
  readFile(evidencePath),
  readFile(lockPath),
  readFile(clientPath, "utf8"),
]);

const parse = (bytes, label) => {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
};

const closeout = parse(closeoutBytes, closeoutPath);
const evidence = parse(evidenceBytes, evidencePath);
const lock = parse(lockBytes, lockPath);
const failures = [];

const require = (condition, message) => {
  if (!condition) failures.push(message);
};

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

require(
  closeout.schemaVersion === "marketplace-registry-pages-retirement-closeout/v1",
  "Unsupported retirement closeout schema.",
);
require(
  closeout.status === "READY_FOR_REGISTRY_OWNER_CLOSEOUT",
  "Retirement closeout status is not ready.",
);
require(
  closeout.scope?.marketplaceDependencyOnLegacyRegistryPages === false,
  "Closeout does not assert Marketplace independence from legacy Registry Pages.",
);
require(
  closeout.registryOwnerCloseoutInstructions?.safeToRetireWithoutRepeatingMarketplaceVerification === true,
  "Closeout does not allow Marketplace verification reuse.",
);
require(
  Array.isArray(closeout.reusePolicy?.requiredReverificationBeforeRegistryPagesRetirement) &&
    closeout.reusePolicy.requiredReverificationBeforeRegistryPagesRetirement.length === 0,
  "Closeout unexpectedly requires Marketplace re-verification.",
);

const producer = closeout.registryProducerEvidence;
require(producer?.repository === lock.producer?.repository, "Producer repository does not match active handoff lock.");
require(producer?.workflow === lock.producer?.workflow, "Producer workflow does not match active handoff lock.");
require(producer?.workflowRevision === lock.producer?.sourceRevision, "Producer revision does not match active handoff lock.");
require(producer?.runId === lock.producer?.runId, "Producer run ID does not match active handoff lock.");
require(producer?.runAttempt === lock.producer?.runAttempt, "Producer run attempt does not match active handoff lock.");
require(producer?.runConclusion === "success", "Producer run conclusion is not success.");
require(
  producer?.distributionArtifact?.id === lock.distributionArtifact?.id &&
    producer?.distributionArtifact?.digest === lock.distributionArtifact?.digest,
  "Distribution artifact binding does not match active handoff lock.",
);
require(
  producer?.handoffEvidenceArtifact?.id === lock.evidenceArtifact?.id &&
    producer?.handoffEvidenceArtifact?.digest === lock.evidenceArtifact?.digest,
  "Handoff evidence binding does not match active handoff lock.",
);

const cutover = closeout.marketplaceCutoverEvidence;
require(
  evidence.consumer?.repository === cutover?.repository,
  "Persisted deployment evidence consumer repository mismatch.",
);
require(
  evidence.consumer?.targetRevision === cutover?.cutoverRevision,
  "Persisted deployment evidence cutover revision mismatch.",
);
require(
  evidence.consumer?.publicBaseUrl === cutover?.publicRegistryBaseUrl,
  "Persisted deployment evidence public base URL mismatch.",
);
require(evidence.producer?.sourceRevision === producer?.workflowRevision, "Persisted producer revision mismatch.");
require(evidence.distributionArtifact?.id === producer?.distributionArtifact?.id, "Persisted distribution artifact ID mismatch.");
require(evidence.evidenceArtifact?.id === producer?.handoffEvidenceArtifact?.id, "Persisted handoff evidence artifact ID mismatch.");

const persisted = cutover?.deploymentEvidenceArtifact;
require(sha256(evidenceBytes) === persisted?.persistedFileSha256, "Persisted deployment evidence SHA-256 mismatch.");
require(evidenceBytes.length === persisted?.persistedFileSize, "Persisted deployment evidence size mismatch.");

for (const [name, value] of Object.entries(cutover?.verification ?? {})) {
  require(value === "PASS", `Marketplace deployment verification is not PASS: ${name}`);
}
for (const [name, value] of Object.entries(cutover?.acceptanceGates ?? {})) {
  require(value === "PASS", `Marketplace acceptance gate is not PASS: ${name}`);
}
for (const [name, value] of Object.entries(producer?.producerVerification ?? {})) {
  require(value === "PASS", `Registry producer verification is not PASS: ${name}`);
}

const newBaseExpression = 'new URL("../registry/", import.meta.url).href';
const legacyBase = cutover?.legacyRegistryBaseUrl;
require(client.includes(newBaseExpression), "Browser consumer is not bound to Marketplace /registry/.");
require(!client.includes(legacyBase), "Browser consumer still contains the legacy Registry Pages endpoint.");

const mustPreserve = new Set(closeout.registryOwnerCloseoutInstructions?.mustPreserve ?? []);
for (const step of [
  "Build signed Pages distribution",
  "Validate generated Pages JSON contracts",
  "Verify generated Pages distribution",
  "Upload exact signed Registry distribution handoff artifact",
  "Generate exact signed Registry distribution handoff evidence",
  "Validate exact signed Registry distribution handoff evidence",
  "Upload signed Registry distribution handoff evidence",
  "Report signed Registry distribution handoff coordinates",
]) {
  require(mustPreserve.has(step), `Registry owner preservation boundary is missing: ${step}`);
}

if (failures.length) {
  console.error("Registry Pages retirement closeout validation FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Registry Pages retirement closeout validation PASS");
console.log("status=READY_FOR_REGISTRY_OWNER_CLOSEOUT");
console.log("marketplace_legacy_pages_dependency=false");
console.log("marketplace_reverification_required=false");
console.log(`cutover_revision=${cutover.cutoverRevision}`);
console.log(`cutover_run_id=${cutover.runId}`);
console.log(`registry_source_revision=${producer.workflowRevision}`);
