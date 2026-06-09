export const ITEM_IMAGES_BUCKET = "item-images";

export function imagePathFromStorageUrl(url: string) {
  const marker = `/storage/v1/object/public/${ITEM_IMAGES_BUCKET}/`;
  const [, path] = url.split(marker);
  return path ? decodeURIComponent(path.split("?")[0]) : null;
}

export function makeImagePath(userId: string, file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExtension = extension.replace(/[^a-z0-9]/g, "") || "jpg";

  return `${userId}/${crypto.randomUUID()}.${safeExtension}`;
}
