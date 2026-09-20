import assert from "node:assert/strict";
import test from "node:test";
import { MARKETPLACE_CATEGORIES } from "../site/assets/marketplace/drawer.js";

test("Marketplace Drawer exposes only the approved temporary categories", () => {
  assert.deepEqual(
    MARKETPLACE_CATEGORIES.map(({ key, label }) => ({ key, label })),
    [
      { key: "translation", label: "번역" },
      { key: "document", label: "문서" }
    ]
  );
});

test("Marketplace Drawer categories remain presentation-only scaffolding", () => {
  assert.equal(MARKETPLACE_CATEGORIES.length, 2);
  for (const category of MARKETPLACE_CATEGORIES) {
    assert.deepEqual(Object.keys(category).sort(), ["key", "label"]);
  }
});
