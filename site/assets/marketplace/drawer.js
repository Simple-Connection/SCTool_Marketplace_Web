export const MARKETPLACE_CATEGORIES = Object.freeze([
  Object.freeze({ key: "translation", label: "번역" }),
  Object.freeze({ key: "document", label: "문서" })
]);

function renderCategories(container) {
  container.replaceChildren();

  for (const category of MARKETPLACE_CATEGORIES) {
    const item = document.createElement("span");
    item.className = "marketplace-category-item";
    item.dataset.categoryKey = category.key;
    item.textContent = category.label;
    container.append(item);
  }
}

export function initializeMarketplaceDrawer({
  drawer = document.querySelector("#marketplace-drawer"),
  toggle = document.querySelector("[data-marketplace-drawer-toggle]"),
  close = document.querySelector("[data-marketplace-drawer-close]"),
  backdrop = document.querySelector("[data-marketplace-drawer-backdrop]"),
  categories = document.querySelector("[data-marketplace-categories]")
} = {}) {
  if (!drawer || !toggle || !close || !backdrop || !categories) {
    throw new Error("Marketplace Drawer mount is incomplete.");
  }

  renderCategories(categories);

  const setOpen = (open) => {
    drawer.classList.toggle("open", open);
    document.body.classList.toggle("marketplace-drawer-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    backdrop.hidden = !open;

    if (open) close.focus();
    else if (document.activeElement === close) toggle.focus();
  };

  toggle.addEventListener("click", () => setOpen(!drawer.classList.contains("open")));
  close.addEventListener("click", () => setOpen(false));
  backdrop.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && drawer.classList.contains("open")) setOpen(false);
  });

  return {
    categories: MARKETPLACE_CATEGORIES,
    close: () => setOpen(false),
    open: () => setOpen(true)
  };
}
