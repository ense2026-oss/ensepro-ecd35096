import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  // สร้างไฟล์ PDF ตอนเปิด (ไม่ดาวน์โหลด) — คืน blob + ชื่อไฟล์
  build: () => Promise<{ blob: Blob; fileName: string }>;
}

// ดูตัวอย่าง PDF ในแอปโดยวาดลง canvas ด้วย pdf.js — ไม่ต้องดาวน์โหลด และใช้ได้ทุกเบราว์เซอร์
// (Android Chrome เปิด PDF แบบ blob ในหน้าต่างใหม่ไม่ได้ มักสั่งดาวน์โหลดแทน)
// pdf.js โหลดแบบ lazy เฉพาะตอนกดดู เพื่อไม่ให้หน้าสลิปช้า
export default function PayslipPdfPreviewDialog({ open, onOpenChange, title, build }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [file, setFile] = useState<{ blob: Blob; fileName: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus("loading");
    setFile(null);

    (async () => {
      try {
        const built = await build();
        if (cancelled) return;
        setFile(built);

        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const workerUrl = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

        const data = new Uint8Array(await built.blob.arrayBuffer());
        const pdf = await pdfjs.getDocument({ data }).promise;
        if (cancelled) return;

        // รอให้ dialog วาง host เสร็จก่อนวัดความกว้าง
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        const host = hostRef.current;
        if (!host || cancelled) return;
        host.innerHTML = "";

        const targetW = Math.max(240, host.clientWidth);
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const cssScale = targetW / base.width;
          const viewport = page.getViewport({ scale: cssScale * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.style.display = "block";
          canvas.style.background = "#fff";
          canvas.style.boxShadow = "0 1px 6px rgba(0,0,0,0.15)";
          if (n > 1) canvas.style.marginTop = "12px";
          host.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
        }
        if (!cancelled) setStatus("ready");
      } catch (e) {
        console.error("payslip preview failed:", e);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => { cancelled = true; };
    // build เป็น closure ใหม่ทุกครั้งที่ render — ผูกกับ open เท่านั้น เพื่อไม่สร้างซ้ำ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleDownload = () => {
    if (!file) return;
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-bold pb-[10px]">{title}</DialogTitle>
          <DialogDescription className="sr-only">ตัวอย่างไฟล์ PDF สลิปเงินเดือน</DialogDescription>
        </DialogHeader>
        <DialogBody className="overflow-y-auto">
          {status === "loading" && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> กำลังเตรียมตัวอย่าง...
            </div>
          )}
          {status === "error" && (
            <p className="py-12 text-center text-sm text-destructive">ไม่สามารถแสดงตัวอย่างได้ ลองกดดาวน์โหลดแทน</p>
          )}
          {/* host ต้องแสดงอยู่เสมอ (ไม่ใช้ hidden) เพื่อให้วัดความกว้างได้ตอนวาด */}
          <div ref={hostRef} className="w-full" />
        </DialogBody>
        <DialogFooter className="gap-2">
          <button onClick={() => onOpenChange(false)} className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">ปิด</button>
          <button
            onClick={handleDownload}
            disabled={!file}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Download className="w-4 h-4" /> ดาวน์โหลด
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
