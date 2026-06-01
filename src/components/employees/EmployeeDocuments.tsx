import { useEffect, useRef, useState, useCallback } from "react";
import { Paperclip, Upload, Trash2, FileText, Eye, Loader2, FileImage, File as FileIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type DocumentCategory = "education" | "work" | "personal";

interface EmployeeDocument {
  id: string;
  employee_id: string;
  category: string;
  name: string;
  file_url: string;
  file_name: string;
  file_type: string;
  created_at: string;
}

interface EmployeeDocumentsProps {
  employeeId: string;
  category: DocumentCategory;
  canEdit: boolean;
  title?: string;
  description?: string;
}

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const fileIconFor = (type: string) => {
  if (type.startsWith("image/")) return FileImage;
  if (type === "application/pdf") return FileText;
  return FileIcon;
};

const EmployeeDocuments = ({ employeeId, category, canEdit, title, description }: EmployeeDocumentsProps) => {
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    const { data } = await supabase
      .from("employee_documents")
      .select("*")
      .eq("employee_id", employeeId)
      .eq("category", category)
      .order("created_at", { ascending: true });
    setDocs((data as EmployeeDocument[]) || []);
    setLoading(false);
  }, [employeeId, category]);

  useEffect(() => {
    setLoading(true);
    fetchDocs();
  }, [fetchDocs]);

  const handlePickFile = () => {
    if (!name.trim()) {
      toast.error("กรุณากรอกชื่อเอกสารก่อนเลือกไฟล์");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!name.trim()) {
      toast.error("กรุณากรอกชื่อเอกสารก่อนอัปโหลด");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 10MB)");
      return;
    }

    setUploading(true);
    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${employeeId}/${category}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("employee-documents")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      const { data: auth } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from("employee_documents").insert({
        employee_id: employeeId,
        category,
        name: name.trim(),
        file_url: path,
        file_name: file.name,
        file_type: file.type || "",
        uploaded_by: auth.user?.id ?? null,
      });
      if (insErr) {
        await supabase.storage.from("employee-documents").remove([path]);
        throw insErr;
      }

      setName("");
      await fetchDocs();
      toast.success("อัปโหลดเอกสารสำเร็จ");
    } catch (err: any) {
      toast.error(err.message || "ไม่สามารถอัปโหลดเอกสารได้");
    } finally {
      setUploading(false);
    }
  };

  const handleView = async (doc: EmployeeDocument) => {
    setOpening(doc.id);
    try {
      const { data, error } = await supabase.storage
        .from("employee-documents")
        .createSignedUrl(doc.file_url, 300);
      if (error || !data?.signedUrl) throw error || new Error("ไม่พบไฟล์");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast.error(err.message || "ไม่สามารถเปิดไฟล์ได้");
    } finally {
      setOpening(null);
    }
  };

  const handleDelete = async (doc: EmployeeDocument) => {
    if (!confirm(`ลบเอกสาร "${doc.name}" ?`)) return;
    try {
      await supabase.storage.from("employee-documents").remove([doc.file_url]);
      const { error } = await supabase.from("employee_documents").delete().eq("id", doc.id);
      if (error) throw error;
      setDocs((d) => d.filter((x) => x.id !== doc.id));
      toast.success("ลบเอกสารแล้ว");
    } catch (err: any) {
      toast.error(err.message || "ไม่สามารถลบเอกสารได้");
    }
  };

  return (
    <div className="rounded-xl border border-border p-4" style={{ background: "hsl(var(--muted) / 0.3)" }}>
      <div className="flex items-center gap-2 mb-1">
        <Paperclip className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold">{title || "เอกสารแนบ"}</p>
      </div>
      {description && <p className="text-xs text-muted-foreground mb-3">{description}</p>}

      {canEdit && (
        <div className="flex flex-col sm:flex-row gap-2 mb-3 mt-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อเอกสาร (กรอกก่อนอัปโหลด)"
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
          <input ref={fileInputRef} type="file" onChange={handleUpload} className="hidden" />
          <button
            type="button"
            onClick={handlePickFile}
            disabled={uploading || !name.trim()}
            className="flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-primary-foreground bg-primary hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? "กำลังอัปโหลด" : "อัปโหลดไฟล์"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted-foreground">ยังไม่มีเอกสารแนบ</div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => {
            const Icon = fileIconFor(doc.file_type);
            return (
              <div key={doc.id} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 flex-shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{doc.file_name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleView(doc)}
                  disabled={opening === doc.id}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                  title="ดูเอกสาร"
                >
                  {opening === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleDelete(doc)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="ลบเอกสาร"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmployeeDocuments;
