import assert from "node:assert/strict";
import test from "node:test";
import {
  DASHBOARD_CATEGORY_LIMIT,
  buildDashboardCategories
} from "../site/assets/dashboard/categories.js";

function item(id, profile = {}) {
  return {
    id,
    profile: {
      details: "details",
      features: "features",
      changelog: "",
      dependencies: "",
      extension_pack: "",
      ...profile
    }
  };
}

test("each dashboard category is capped at ten items", () => {
  const items = Array.from({ length: 14 }, (_, index) => item("tool-" + String(index)));
  const categories = buildDashboardCategories(items);
  const recommended = categories.find((category) => category.key === "recommended");
  assert.equal(DASHBOARD_CATEGORY_LIMIT, 10);
  assert.equal(recommended.items.length, 10);
  assert.deepEqual(recommended.items.map((entry) => entry.id), items.slice(0, 10).map((entry) => entry.id));
});

test("optional profile metadata creates presentation groups without semantic inference", () => {
  const categories = buildDashboardCategories([
    item("base"),
    item("extension", { extension_pack: "pack" }),
    item("dependency", { dependencies: "dep" }),
    item("change", { changelog: "notes" })
  ]);

  assert.deepEqual(categories.find((category) => category.key === "extension-pack").items.map((entry) => entry.id), ["extension"]);
  assert.deepEqual(categories.find((category) => category.key === "dependencies").items.map((entry) => entry.id), ["dependency"]);
  assert.deepEqual(categories.find((category) => category.key === "changelog").items.map((entry) => entry.id), ["change"]);
});

test("empty optional categories are omitted", () => {
  const categories = buildDashboardCategories([item("base")]);
  assert.deepEqual(categories.map((category) => category.key), ["recommended"]);
});
