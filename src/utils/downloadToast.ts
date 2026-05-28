import { toast } from "sonner";

export function createDownloadProgressToast(label = "กำลังดาวน์โหลดสลิป") {
  const id = toast.loading(`${label}... 0%`);
  const onProgress = (pct: number) => {
    const p = Math.max(0, Math.min(100, Math.round(pct)));
    if (p >= 100) {
      toast.success(`ดาวน์โหลดสำเร็จ (100%)`, { id });
    } else {
      toast.loading(`${label}... ${p}%`, { id });
    }
  };
  const onError = (msg = "ดาวน์โหลดไม่สำเร็จ") => toast.error(msg, { id });
  return { onProgress, onError, id };
}
