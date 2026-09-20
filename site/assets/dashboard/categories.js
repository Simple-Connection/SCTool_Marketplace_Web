export const DASHBOARD_CATEGORY_LIMIT = 10;

const CATEGORY_DEFINITIONS = [
  {
    key: "recommended",
    title: "전체 추천",
    description: "Marketplace에 공개된 SCTool",
    matches: () => true
  },
  {
    key: "extension-pack",
    title: "확장팩 정보",
    description: "확장팩 정보가 공개된 SCTool",
    matches: (item) => Boolean(item?.profile?.extension_pack?.trim())
  },
  {
    key: "dependencies",
    title: "의존성 정보",
    description: "의존성 정보가 공개된 SCTool",
    matches: (item) => Boolean(item?.profile?.dependencies?.trim())
  },
  {
    key: "changelog",
    title: "변경사항 제공",
    description: "변경사항 정보가 공개된 SCTool",
    matches: (item) => Boolean(item?.profile?.changelog?.trim())
  }
];

export function buildDashboardCategories(items, limit = DASHBOARD_CATEGORY_LIMIT) {
  if (!Array.isArray(items)) throw new TypeError("Dashboard items must be an array.");
  if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError("Dashboard category limit must be a positive integer.");

  return CATEGORY_DEFINITIONS
    .map((definition) => ({
      key: definition.key,
      title: definition.title,
      description: definition.description,
      items: items.filter(definition.matches).slice(0, limit)
    }))
    .filter((category) => category.items.length > 0);
}
