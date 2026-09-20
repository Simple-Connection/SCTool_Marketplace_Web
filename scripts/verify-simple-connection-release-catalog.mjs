import { writeFile } from "node:fs/promises";
import {
  SIMPLE_CONNECTION_RELEASE_CATALOG_URL,
  ReleaseCatalogError,
  loadReleaseCatalog
} from "../site/assets/application/simple-connection/release-catalog-client.js";
import { buildReleaseViewModel } from "../site/assets/application/simple-connection/release-view-model.js";

const evidencePath = "simple-connection-release-catalog-evidence.json";

try {
  const catalog = await loadReleaseCatalog();
  const view = buildReleaseViewModel(catalog);

  if (view.empty || !view.latest) {
    throw new ReleaseCatalogError(
      "LIVE_CATALOG_EMPTY",
      "Canonical Simple Connection release catalog에 검증 가능한 latest release가 없습니다.",
      { url: SIMPLE_CONNECTION_RELEASE_CATALOG_URL }
    );
  }

  const evidence = {
    verifiedAt: new Date().toISOString(),
    catalogUrl: SIMPLE_CONNECTION_RELEASE_CATALOG_URL,
    schemaVersion: catalog.schemaVersion,
    latestVersion: catalog.latestVersion,
    releaseCount: view.rows.length,
    latest: {
      version: view.latest.version,
      status: view.latest.status,
      fileName: view.latest.fileName,
      downloadUrl: view.latest.downloadUrl
    }
  };

  await writeFile(evidencePath, JSON.stringify(evidence, null, 2) + "\n", "utf8");
  console.log("Simple Connection canonical catalog verification PASS");
  console.log(JSON.stringify(evidence));
} catch (error) {
  const known = error instanceof ReleaseCatalogError;
  const evidence = {
    verifiedAt: new Date().toISOString(),
    catalogUrl: SIMPLE_CONNECTION_RELEASE_CATALOG_URL,
    ok: false,
    error: {
      code: known ? error.code : "UNKNOWN",
      message: known ? error.diagnosticText() : String(error)
    }
  };
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2) + "\n", "utf8");
  console.error("Simple Connection canonical catalog verification FAILED");
  console.error(JSON.stringify(evidence));
  process.exitCode = 1;
}
