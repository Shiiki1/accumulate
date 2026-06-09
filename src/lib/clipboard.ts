export function getImageFromClipboard(clipboardData: DataTransfer | null) {
  if (!clipboardData) return null;

  const fileFromList = Array.from(clipboardData.files).find((item) =>
    item.type.startsWith("image/"),
  );

  if (fileFromList) return normalizePastedImage(fileFromList);

  const fileFromItem = Array.from(clipboardData.items)
    .find((item) => item.type.startsWith("image/"))
    ?.getAsFile();

  return fileFromItem ? normalizePastedImage(fileFromItem) : null;
}

export function getClipboardText(clipboardData: DataTransfer | null) {
  return clipboardData?.getData("text/plain").trim() ?? "";
}

export function isProbablyUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;

  try {
    new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return trimmed.includes(".");
  } catch {
    return false;
  }
}

export function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("http://") || trimmed.startsWith("https://")
    ? trimmed
    : `https://${trimmed}`;
}

export function urlDomain(value: string) {
  try {
    return new URL(normalizeUrl(value)).hostname.replace(/^www\./, "");
  } catch {
    return value.trim();
  }
}

export function titleFromUrl(value: string) {
  const domain = urlDomain(value);
  const name = domain.split(".")[0] || domain;

  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function pastedImageTitle(file: File) {
  return file.name.startsWith("pasted-image")
    ? "Pasted image"
    : file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
}

function normalizePastedImage(file: File) {
  if (file.name && !file.name.startsWith("image.")) return file;

  const extension = file.type.split("/")[1] || "png";
  return new File([file], `pasted-image.${extension}`, {
    type: file.type,
    lastModified: Date.now(),
  });
}
