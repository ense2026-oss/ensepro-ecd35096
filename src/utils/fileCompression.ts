import { toast } from "sonner";

interface CompressOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
}

const FILE_LIMITS = {
  image: 5 * 1024 * 1024,   // 5MB
  pdf: 10 * 1024 * 1024,    // 10MB
};

/**
 * Validate file size before processing
 */
export function validateFileSize(file: File, type: "image" | "pdf" = "image"): boolean {
  const limit = FILE_LIMITS[type];
  if (file.size > limit) {
    const limitMB = limit / (1024 * 1024);
    toast.error(`ไฟล์มีขนาดใหญ่เกินไป (สูงสุด ${limitMB}MB)`);
    return false;
  }
  return true;
}

/**
 * Compress an image file using Canvas API.
 * Returns a base64 data URL string.
 */
export function compressImage(
  file: File,
  options: CompressOptions = { maxWidth: 800, maxHeight: 800, quality: 0.8 }
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      // Not an image — read as-is
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      const { maxWidth, maxHeight, quality } = options;

      // Calculate new dimensions maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Use JPEG for photos (smaller), PNG for transparent images
      const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
      const dataUrl = canvas.toDataURL(outputType, quality);

      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

/**
 * Convert a base64 data URL to a Blob (for Storage upload / migrating legacy data).
 */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const comma = dataUrl.indexOf(",");
    if (comma < 0) return null;
    const header = dataUrl.slice(0, comma);
    const b64 = dataUrl.slice(comma + 1);
    const mime = /data:([^;]+)/.exec(header)?.[1] || "application/octet-stream";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

/**
 * Compress an image (File or Blob) to a WebP Blob via Canvas — for Storage upload.
 * WebP gives noticeably smaller files than JPEG at the same quality. Returns null
 * if the input isn't an image or can't be decoded (e.g. HEIC).
 */
export function compressImageToBlob(
  file: Blob,
  options: CompressOptions = { maxWidth: 1600, maxHeight: 1600, quality: 0.8 }
): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve(null);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const { maxWidth, maxHeight, quality } = options;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob), "image/webp", quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Prepare any upload for Storage: compress images to WebP, pass PDFs/other files
 * through untouched. Returns the body to upload plus the matching extension and
 * content type. Used by employee documents / leave attachments so every image
 * lands in the bucket already optimized.
 */
export async function prepareUpload(
  file: File,
  imageOptions?: CompressOptions
): Promise<{ body: Blob; ext: string; contentType: string }> {
  if (file.type.startsWith("image/")) {
    const blob = await compressImageToBlob(file, imageOptions);
    if (blob) return { body: blob, ext: "webp", contentType: "image/webp" };
  }
  return {
    body: file,
    ext: (file.name.split(".").pop() || "bin").toLowerCase(),
    contentType: file.type || "application/octet-stream",
  };
}

/**
 * Create a small thumbnail from an image file.
 */
export function createThumbnail(file: File, size: number = 150): Promise<string> {
  return compressImage(file, { maxWidth: size, maxHeight: size, quality: 0.7 });
}

/**
 * Validate PDF file size (client-side compression not feasible).
 * Returns true if valid, false if too large.
 */
export function validatePDF(file: File): boolean {
  if (file.size > FILE_LIMITS.pdf) {
    toast.error("ไฟล์ PDF มีขนาดใหญ่เกินไป (สูงสุด 10MB) กรุณาลดขนาดก่อนอัปโหลด");
    return false;
  }
  if (file.size > 5 * 1024 * 1024) {
    toast("ไฟล์ PDF มีขนาดค่อนข้างใหญ่ อาจทำให้โหลดช้า", { description: "แนะนำให้ลดขนาดไฟล์ลงก่อนอัปโหลด" });
  }
  return true;
}

/**
 * Process a file upload — compress images, validate PDFs.
 * Returns base64 data URL or null if invalid.
 */
export async function processFileUpload(
  file: File,
  imageOptions?: CompressOptions
): Promise<string | null> {
  if (file.type.startsWith("image/")) {
    if (!validateFileSize(file, "image")) return null;
    try {
      return await compressImage(file, imageOptions);
    } catch {
      // Some formats (e.g. HEIC/HEIF from iPhones) can't be decoded by the browser canvas
      const isHeic = /hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
      toast.error(
        isHeic
          ? "ไฟล์รูปแบบ HEIC ไม่รองรับ กรุณาแปลงเป็น JPG หรือ PNG ก่อนอัปโหลด"
          : "ไม่สามารถประมวลผลรูปภาพได้ กรุณาลองไฟล์ JPG หรือ PNG"
      );
      return null;
    }
  }


  if (file.type === "application/pdf") {
    if (!validatePDF(file)) return null;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => { toast.error("ไม่สามารถอ่านไฟล์ได้"); resolve(null); };
      reader.readAsDataURL(file);
    });
  }

  // Other file types — just read as-is with size check
  if (file.size > FILE_LIMITS.pdf) {
    toast.error("ไฟล์มีขนาดใหญ่เกินไป");
    return null;
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => { toast.error("ไม่สามารถอ่านไฟล์ได้"); resolve(null); };
    reader.readAsDataURL(file);
  });
}
