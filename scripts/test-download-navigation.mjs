import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const navigation = await readFile("site/assets/shared/navigation.js", "utf8");
const marketplace = await readFile("site/marketplace/index.html", "utf8");
const downloads = await readFile("site/application/simple_connection/downloads/index.html", "utf8");

test("download accordion exposes both independent destinations", () => {
  assert.match(navigation, /label: "SCTool Marketplace"/);
  assert.match(navigation, /label: "Simple Connection"/);
  assert.match(navigation, /path: "marketplace\/"/);
  assert.match(navigation, /path: "application\/simple_connection\/downloads\/"/);
});

test("download pages identify their own active local-navigation item", () => {
  assert.match(marketplace, /data-section="download" data-subnav="marketplace"/);
  assert.match(downloads, /data-section="download" data-subnav="simple-connection"/);
});

test("Marketplace category Drawer remains independent from the download accordion", () => {
  assert.match(marketplace, /id="marketplace-drawer"/);
  assert.doesNotMatch(downloads, /marketplace-drawer/);
});
