function formatBytes(value) {
  if (!Number.isSafeInteger(value) || value < 0) return "";
  if (value < 1024) return String(value) + " B";
  const units = ["KB", "MB", "GB"];
  let size = value / 1024;
  let unit = units[0];

  for (let index = 1; index < units.length && size >= 1024; index += 1) {
    size /= 1024;
    unit = units[index];
  }

  return (size >= 10 ? size.toFixed(0) : size.toFixed(1)) + " " + unit;
}

function formatDate(value) {
  if (!value) return "—";
  const exact = /^\d{4}-\d{2}-\d{2}/.exec(value);
  return exact ? exact[0] : value;
}

function platformLabel(platform, arch) {
  const platformName = {
    win: "Windows",
    darwin: "macOS",
    linux: "Linux"
  }[platform] || platform || "Unknown";

  return [platformName, arch].filter(Boolean).join(" ");
}

export function buildReleaseViewModel(catalog) {
  const rows = catalog.releases.map((release) => ({
    version: release.version,
    status: release.latest === true ? "Latest" : "Previous",
    latest: release.latest === true,
    platformLabel: platformLabel(release.platform || catalog.platform, release.arch || catalog.arch),
    releaseDate: formatDate(release.releasedAt),
    fileName: release.fileName,
    sizeLabel: formatBytes(release.size),
    downloadUrl: release.downloadUrl
  }));

  return {
    empty: rows.length === 0,
    latest: rows.find((release) => release.latest) || null,
    rows
  };
}
