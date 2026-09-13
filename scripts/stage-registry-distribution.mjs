import { stageRegistryDistribution } from "./lib/registry-distribution.mjs";

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const source = readArg("--source");
const destination = readArg("--destination");
if (!source || !destination) {
  console.error("Usage: node scripts/stage-registry-distribution.mjs --source <signed-distribution-dir> --destination <pages-registry-dir>");
  process.exit(2);
}

try {
  const result = await stageRegistryDistribution(source, destination);
  console.log("Registry distribution staging PASS");
  console.log(`revision=${result.revision}`);
  console.log(`sequence=${result.sequence}`);
  console.log(`trust_sequence=${result.trustSequence}`);
  console.log(`destination=${result.destination}`);
} catch (error) {
  console.error(`Registry distribution staging FAILED [${error.code ?? "UNKNOWN"}]`);
  console.error(error.message);
  process.exit(1);
}
