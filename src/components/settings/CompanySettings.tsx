import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useBranding } from "@/contexts/BrandingContext";
import { Upload, X } from "lucide-react";

interface CompanyInfo {
  name: string;
  registrationNo: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  mapsUrl: string;
}

const initialData: CompanyInfo = {
  name: "บริษัท เอ็กซ์วาย จำกัด",
  registrationNo: "0105567012345",
  address: "123 ถ.สุขุมวิท แขวงคลองเตย กทม. 10110",
  phone: "02-xxx-xxxx",
  email: "info@company.com",
  website: "https://www.company.com",
  mapsUrl: "",
};

const fields: { key: keyof Omit<CompanyInfo, "mapsUrl">; label: string; placeholder: string }[] = [
  { key: "name", label: "ชื่อบริษัท", placeholder: "ชื่อบริษัท" },
  { key: "registrationNo", label: "เลขทะเบียนบริษัท", placeholder: "เลขทะเบียน" },
  { key: "address", label: "ที่อยู่", placeholder: "ที่อยู่" },
  { key: "phone", label: "เบอร์โทรศัพท์", placeholder: "เบอร์โทร" },
  { key: "email", label: "Email", placeholder: "Email" },
  { key: "website", label: "Website", placeholder: "Website URL" },
];

const CompanySettings = () => {
  const { toast } = useToast();
  const { programName, programSubtitle, logoUrl, logoOnlyUrl, displayMode, setProgramName, setProgramSubtitle, setLogoUrl, setLogoOnlyUrl, setDisplayMode } = useBranding();
  const [form, setForm] = useState<CompanyInfo>(initialData);
  const [saved, setSaved] = useState<CompanyInfo>(initialData);
  const [brandName, setBrandName] = useState(programName);
  const [brandSubtitle, setBrandSubtitle] = useState(programSubtitle);
  const [previewLogo, setPreviewLogo] = useState<string | null>(logoUrl);
  const [previewLogoOnly, setPreviewLogoOnly] = useState<string | null>(logoOnlyUrl);
  const [brandDisplayMode, setBrandDisplayMode] = useState<"logo-only" | "logo-and-name">(displayMode);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputOnlyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreviewLogo(logoUrl);
  }, [logoUrl]);

  useEffect(() => {
    setPreviewLogoOnly(logoOnlyUrl);
  }, [logoOnlyUrl]);

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved);
  const isBrandDirty = brandName !== programName || brandSubtitle !== programSubtitle || previewLogo !== logoUrl || previewLogoOnly !== logoOnlyUrl || brandDisplayMode !== displayMode;

  const handleSave = () => {
    setSaved({ ...form });
    toast({ title: "บันทึกสำเร็จ", description: "ข้อมูลบริษัทถูกอัปเดตแล้ว" });
  };

  const handleReset = () => {
    setForm({ ...saved });
  };

  const handleBrandSave = () => {
    setProgramName(brandName);
    setProgramSubtitle(brandSubtitle);
    setLogoUrl(previewLogo);
    setLogoOnlyUrl(previewLogoOnly);
    setDisplayMode(brandDisplayMode);
    toast({ title: "บันทึกสำเร็จ", description: "โลโก้และชื่อโปรแกรมถูกอัปเดตแล้ว" });
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreviewLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleLogoOnlyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreviewLogoOnly(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setPreviewLogo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveLogoOnly = () => {
    setPreviewLogoOnly(null);
    if (fileInputOnlyRef.current) fileInputOnlyRef.current.value = "";
  };

  return (
    <div className="space-y-8">
      {/* Branding section */}
      <div>
        <h3 className="text-base font-bold mb-4">โลโก้และชื่อโปรแกรม</h3>
        {/* Display mode toggle */}
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">รูปแบบการแสดงผล</label>
          <div className="inline-flex rounded-xl border overflow-hidden">
            <button
              type="button"
              onClick={() => setBrandDisplayMode("logo-and-name")}
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{
                background: brandDisplayMode === "logo-and-name" ? "hsl(var(--primary))" : "transparent",
                color: brandDisplayMode === "logo-and-name" ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
              }}
            >
              โลโก้ + ชื่อโปรแกรม
            </button>
            <button
              type="button"
              onClick={() => setBrandDisplayMode("logo-only")}
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{
                background: brandDisplayMode === "logo-only" ? "hsl(var(--primary))" : "transparent",
                color: brandDisplayMode === "logo-only" ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
              }}
            >
              เฉพาะโลโก้
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Logo upload for current mode */}
          {brandDisplayMode === "logo-and-name" ? (
            <>
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold mb-1.5">โลโก้โปรแกรม (ขนาดเล็ก)</label>
                <p className="text-xs text-muted-foreground mb-2">ใช้แสดงคู่กับชื่อโปรแกรม</p>
                <div className="flex items-center gap-4">
                  {previewLogo ? (
                    <div className="relative">
                      <img src={previewLogo} alt="Logo" className="w-14 h-14 rounded-xl object-cover border" />
                      <button
                        onClick={handleRemoveLogo}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-xl border-2 border-dashed flex items-center justify-center text-muted-foreground">
                      <Upload className="w-5 h-5" />
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl text-sm font-medium border hover:bg-muted transition-colors"
                  >
                    เลือกรูปภาพ
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">ชื่อโปรแกรม</label>
                <input
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="HRPro"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">คำอธิบาย</label>
                <input
                  value={brandSubtitle}
                  onChange={(e) => setBrandSubtitle(e.target.value)}
                  placeholder="Enterprise"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30"
                />
              </div>
            </>
          ) : (
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold mb-1.5">โลโก้โปรแกรม (ขนาดใหญ่)</label>
              <p className="text-xs text-muted-foreground mb-2">ใช้แสดงเต็มพื้นที่แทนชื่อโปรแกรม</p>
              <div className="flex items-center gap-4">
                {previewLogoOnly ? (
                  <div className="relative">
                    <img src={previewLogoOnly} alt="Logo" className="w-20 h-20 rounded-xl object-cover border" />
                    <button
                      onClick={handleRemoveLogoOnly}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center text-muted-foreground">
                    <Upload className="w-6 h-6" />
                  </div>
                )}
                <input ref={fileInputOnlyRef} type="file" accept="image/*" onChange={handleLogoOnlyChange} className="hidden" />
                <button
                  onClick={() => fileInputOnlyRef.current?.click()}
                  className="px-4 py-2 rounded-xl text-sm font-medium border hover:bg-muted transition-colors"
                >
                  เลือกรูปภาพ
                </button>
              </div>
            </div>
          )}
        </div>
        {isBrandDirty && (
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleBrandSave}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-primary-foreground"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}
            >
              บันทึกการตั้งค่า
            </button>
            <button
              onClick={() => { setBrandName(programName); setBrandSubtitle(programSubtitle); setPreviewLogo(logoUrl); setPreviewLogoOnly(logoOnlyUrl); setBrandDisplayMode(displayMode); }}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              ยกเลิก
            </button>
          </div>
        )}
      </div>

      <hr className="border-border" />

      {/* Company info section */}
      <div>
        <h3 className="text-base font-bold mb-4">ข้อมูลบริษัท</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-semibold mb-1.5">{f.label}</label>
              <input
                value={form[f.key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30"
              />
            </div>
          ))}
        </div>
        <div className="mt-4">
          <label className="block text-sm font-semibold mb-1.5">Google Maps Embed URL</label>
          <textarea
            rows={3}
            value={form.mapsUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, mapsUrl: e.target.value }))}
            className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30 resize-none"
            placeholder="วาง Google Maps Embed URL..."
          />
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-primary-foreground disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: isDirty ? "0 4px 12px hsl(var(--primary) / 0.3)" : "none" }}
          >
            บันทึกข้อมูล
          </button>
          {isDirty && (
            <button
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              ยกเลิกการแก้ไข
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompanySettings;
