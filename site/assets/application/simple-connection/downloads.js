import { loadReleaseCatalog } from "./release-catalog-client.js";
import { createReleasePageView } from "./release-page-view.js";
import { initializeShell } from "../../shared/shell.js";

initializeShell();

const pageView = createReleasePageView();

async function initialize() {
  try {
    pageView.renderCatalog(await loadReleaseCatalog());
  } catch (error) {
    pageView.renderFailure(error);
  }
}

void initialize();
