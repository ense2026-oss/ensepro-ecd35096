import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Upload } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSign: (type: "draw" | "upload", data: string) => void;
  signerName: string;
}

const SignatureDialog = ({ open, onOpenChange, onSign, signerName }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [tab, setTab] = useState<"draw" | "upload">("draw");

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setHasDrawn(false);
      setUploadedImage(null);
      setTab("draw");
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        }
      }, 100);
    }
  }, [open]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawn(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => {
    if (tab === "draw" && hasDrawn && canvasRef.current) {
      onSign("draw", canvasRef.current.toDataURL("image/png"));
    } else if (tab === "upload" && uploadedImage) {
      onSign("upload", uploadedImage);
    }
    onOpenChange(false);
  };

  const canConfirm = (tab === "draw" && hasDrawn) || (tab === "upload" && !!uploadedImage);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>ลงนาม — {signerName}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "draw" | "upload")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="draw" className="gap-1.5"><Pencil className="w-4 h-4" />วาดลายเซ็น</TabsTrigger>
            <TabsTrigger value="upload" className="gap-1.5"><Upload className="w-4 h-4" />อัพโหลด</TabsTrigger>
          </TabsList>

          <TabsContent value="draw" className="mt-4">
            <div className="border rounded-lg overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                width={440}
                height={200}
                className="w-full cursor-crosshair touch-none"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
              />
            </div>
            <Button variant="ghost" size="sm" onClick={clearCanvas} className="mt-2">ล้างลายเซ็น</Button>
          </TabsContent>

          <TabsContent value="upload" className="mt-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              {uploadedImage ? (
                <div className="space-y-3">
                  <img src={uploadedImage} alt="signature" className="max-h-32 mx-auto" />
                  <Button variant="ghost" size="sm" onClick={() => setUploadedImage(null)}>เลือกไฟล์ใหม่</Button>
                </div>
              ) : (
                <label className="cursor-pointer space-y-2 block">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">คลิกเพื่ออัพโหลดไฟล์ลายเซ็น (PNG, JPG)</p>
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileUpload} />
                </label>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>ยืนยันลงนาม</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SignatureDialog;
