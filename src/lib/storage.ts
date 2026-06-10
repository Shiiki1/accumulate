import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";

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

type UploadedMediaFile = {
  path: string;
  publicUrl: string;
};

async function resolveStorageUser() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Sign in before uploading images.");
  }

  return { supabase, userId: user.id };
}

export async function uploadMediaFile(file: File): Promise<UploadedMediaFile> {
  if (!hasSupabaseEnv()) {
    throw new Error(
      "Supabase Storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then create the item-images bucket.",
    );
  }

  const { supabase, userId } = await resolveStorageUser();
  const path = makeImagePath(userId, file);
  const { error } = await supabase.storage
    .from(ITEM_IMAGES_BUCKET)
    .upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type || undefined,
      upsert: false,
    });

  if (error) {
    throw new Error(`Could not upload image to Supabase Storage: ${error.message}`);
  }

  const { data } = supabase.storage.from(ITEM_IMAGES_BUCKET).getPublicUrl(path);

  if (!data.publicUrl) {
    throw new Error("Could not create a public URL for the uploaded image.");
  }

  return {
    path,
    publicUrl: data.publicUrl,
  };
}

export async function deleteStoredMediaFile(url: string | null | undefined) {
  if (!url || !hasSupabaseEnv()) return;

  const path = imagePathFromStorageUrl(url);
  if (!path) return;

  const supabase = createClient();
  await supabase.storage.from(ITEM_IMAGES_BUCKET).remove([path]);
}
