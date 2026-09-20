import { siteUrl } from "./navigation.js";

export function initializeGlobalSearch(form, input) {
  if (!form || !input) return;

  const params = new URL(window.location.href).searchParams;
  if (!input.value && params.has("q")) input.value = params.get("q") || "";

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = input.value.trim();
    const target = siteUrl("marketplace/");
    if (query) target.searchParams.set("q", query);
    window.location.assign(target.href);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
    if (typing) return;
    event.preventDefault();
    input.focus();
  });
}
