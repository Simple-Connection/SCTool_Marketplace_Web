import { cp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { stageRegistryDistribution } from "./lib/registry-distribution.mjs";

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const output = resolve(readArg("--out") || "_site");
const registrySource = readArg("--registry-source");

await rm(output, { recursive: true, force: true });
await cp("site", output, { recursive: true });

if (registrySource) {
  const staged = await stageRegistryDistribution(registrySource, resolve(output, "registry"));
  console.log(
    `Pages artifact assembled with signed Registry distribution revision=${staged.revision} sequence=${staged.sequence}.`,
  );
} else {
  console.log("Pages artifact assembled in Phase 1 mode; no Registry distribution was materialized.");
  console.log("Production browser Registry base URL remains the existing sctool-registry Pages endpoint.");
}
