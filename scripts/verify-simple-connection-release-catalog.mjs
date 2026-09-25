import { writeFile } from "node:fs/promises";
import {
  SIMPLE_CONNECTION_RELEASE_CATALOG_URL,
  ReleaseCatalogError
} from "../site/assets/application/simple-connection/release-catalog-client.js";
import { verifySimpleConnectionPublicRelease } from "./lib/simple-connection-public-release.mjs";

const evidencePath = "simple-connection-release-catalog-evidence.json";

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || "" : "";
}

const consumerUrl = optionValue("--consumer-url");

try {
  if (!consumerUrl) {
    throw new ReleaseCatalogError(
      "CONSUMER_URL_REQUIRED",
      "Public release verification에는 실제 SC_WEP consumer URL이 필요합니다.",
      { url: SIMPLE_CONNECTION_RELEASE_CATALOG_URL }
    );
  }

  const verification = await verifySimpleConnectionPublicRelease({
    consumerUrl
  });

  const evidence = {
    verifiedAt: new Date().toISOString(),
    ok: true,
    ...verification
  };

  await writeFile(evidencePath, JSON.stringify(evidence, null, 2) + "\n", "utf8");
  console.log("Simple Connection canonical public release verification PASS");
  console.log(JSON.stringify(evidence));
} catch (error) {
  const known = error instanceof ReleaseCatalogError;
  const evidence = {
    verifiedAt: new Date().toISOString(),
    catalogUrl: SIMPLE_CONNECTION_RELEASE_CATALOG_URL,
    consumerUrl,
    ok: false,
    error: {
      code: known ? error.code : "UNKNOWN",
      message: known ? error.diagnosticText() : String(error)
    }
  };

  await writeFile(evidencePath, JSON.stringify(evidence, null, 2) + "\n", "utf8");
  console.error("Simple Connection canonical public release verification FAILED");
  console.error(JSON.stringify(evidence));
  process.exitCode = 1;
}
