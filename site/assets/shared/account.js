export function renderAccountSlot(container) {
  container.replaceChildren();

  const slot = document.createElement("div");
  slot.className = "account-slot";
  slot.dataset.authState = "unconfigured";
  slot.setAttribute("aria-label", "GitHub 계정 슬롯. 인증 계약은 아직 연결되지 않았습니다.");

  const avatar = document.createElement("span");
  avatar.className = "account-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = "GH";

  const label = document.createElement("span");
  label.className = "account-label";
  label.textContent = "GitHub";

  slot.append(avatar, label);
  container.append(slot);
}
