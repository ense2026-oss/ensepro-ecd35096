import { supabase } from "@/integrations/supabase/client";
import { compressImageToBlob, dataUrlToBlob } from "@/utils/fileCompression";

export const EMPLOYEE_PHOTOS_BUCKET = "employee-photos";

/**
 * True when the stored value is a Storage path (not a legacy base64 data URL
 * and not an already-resolved http(s) signed/public URL).
 */
export function isStoragePath(v?: string | null): v is string {
  return !!v && !v.startsWith("data:") && !/^https?:\/\//i.test(v);
}

/**
 * Upload a base64 avatar to the employee-photos bucket (re-compressed to WebP
 * ~400px) and return its Storage path. The row stores only this short path.
 */
export async function uploadEmployeePhoto(employeeId: string, dataUrl: string): Promise<string> {
  const raw = dataUrlToBlob(dataUrl);
  if (!raw) throw new Error("รูปโปรไฟล์ไม่ถูกต้อง");
  const compressed = (await compressImageToBlob(raw, { maxWidth: 400, maxHeight: 400, quality: 0.8 })) || raw;
  const path = `${employeeId}/avatar-${Date.now()}.webp`;
  const { error } = await supabase.storage.from(EMPLOYEE_PHOTOS_BUCKET).upload(path, compressed, {
    upsert: true,
    contentType: compressed.type || "image/webp",
    cacheControl: "3600",
  });
  if (error) throw error;
  return path;
}

/** Remove a photo object from Storage (best-effort; ignores errors). */
export async function removeEmployeePhoto(path?: string | null): Promise<void> {
  if (!isStoragePath(path)) return;
  try {
    await supabase.storage.from(EMPLOYEE_PHOTOS_BUCKET).remove([path]);
  } catch {
    /* best-effort cleanup */
  }
}

/**
 * Batch-resolve Storage paths → signed URLs for display. One request for all
 * paths. Returns a map keyed by the original path.
 */
export async function resolveEmployeePhotoUrls(
  paths: string[],
  expiresIn = 86400,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(paths.filter(isStoragePath))];
  if (unique.length === 0) return map;
  const { data } = await supabase.storage.from(EMPLOYEE_PHOTOS_BUCKET).createSignedUrls(unique, expiresIn);
  (data || []).forEach((r: { path?: string | null; signedUrl?: string | null }) => {
    if (r.path && r.signedUrl) map.set(r.path, r.signedUrl);
  });
  return map;
}
