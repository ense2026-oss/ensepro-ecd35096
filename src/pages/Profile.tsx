import { useState } from "react";
import {
  User, Mail, Phone, Shield, Camera, Lock, Eye, EyeOff,
  Briefcase, Heart, GraduationCap, History, MapPin, Calendar,
  Building2, Hash, FileText, Users, Award
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Profile = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("personal");
  const [isEditing, setIsEditing] = useState(false);
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const [form, setForm] = useState({
    name: "Admin User",
    nickname: "แอด",
    email: "admin@company.com",
    phone: "081-xxx-xxxx",
    position: "ผู้ดูแลระบบ",
    department: "งานเทคโนโลยีสารสนเทศ",
    employeeId: "EMP-001",
    faceScanId: "20033",
    role: "Administrator",
    level: "ต้น",
    startDate: "01/01/2565",
    yearsWorked: 3,
    lineId: "@admin",
    address: "123 ถ.สุขุมวิท กรุงเทพฯ 10110",
    birthDate: "15/06/2535",
    gender: "ชาย",
    nationality: "ไทย",
    religion: "พุทธ",
    idCard: "1-xxxx-xxxxx-xx-x",
    // Family
    spouseName: "-",
    childrenCount: 1,
    emergencyContact: "คุณแม่ 089-xxx-xxxx",
    // Education
    educationLevel: "ปริญญาตรี",
    institution: "มหาวิทยาลัยเทคโนโลยี",
    major: "วิทยาการคอมพิวเตอร์",
    graduationYear: "2557",
  });

  const [saved, setSaved] = useState({ ...form });
  const [pwForm, setPwForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const isDirty = JSON.stringify(form) !== JSON.stringify(saved);

  const handleSave = () => {
    setSaved({ ...form });
    setIsEditing(false);
    toast({ title: "บันทึกสำเร็จ", description: "ข้อมูลโปรไฟล์ถูกอัปเดตแล้ว" });
  };

  const handleCancel = () => {
    setForm({ ...saved });
    setIsEditing(false);
  };

  const handleChangePassword = () => {
    if (!pwForm.oldPassword || !pwForm.newPassword) {
      toast({ title: "กรุณากรอกข้อมูลให้ครบ", variant: "destructive" });
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast({ title: "รหัสผ่านใหม่ไม่ตรงกัน", variant: "destructive" });
      return;
    }
    setPwForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    toast({ title: "เปลี่ยนรหัสผ่านสำเร็จ", description: "รหัสผ่านของคุณถูกอัปเดตแล้ว" });
  };

  const tabs = [
    { id: "personal", label: "ข้อมูลส่วนตัว", icon: User },
    { id: "work", label: "ข้อมูลการทำงาน", icon: Briefcase },
    { id: "family", label: "ข้อมูลครอบครัว", icon: Heart },
    { id: "education", label: "ประวัติการศึกษา", icon: GraduationCap },
    { id: "workhistory", label: "ประวัติการทำงาน", icon: History },
    { id: "security", label: "ความปลอดภัย", icon: Lock },
  ];

  const stats = [
    { value: saved.faceScanId, label: "Face Scan ID", color: "hsl(142 71% 45%)" },
    { value: saved.yearsWorked, label: "ปีที่ทำงาน", color: "hsl(142 71% 45%)" },
    { value: saved.childrenCount, label: "จำนวนบุตร", color: "hsl(var(--primary))" },
    { value: "0", label: "ประวัติการทำงาน", color: "hsl(31 100% 50%)" },
  ];

  const ReadField = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) => (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
      <Icon className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );

  const EditField = ({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) => (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30 disabled:opacity-50"
      />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Hero Profile Header */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))" }}
      >
        <div className="p-6 pb-0">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5">
            {/* Avatar */}
            <div className="relative -mb-10 z-10">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold border-4"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))",
                  color: "hsl(var(--primary-foreground))",
                  borderColor: "hsl(var(--background))",
                }}
              >
                AD
              </div>
              <button
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center border-2 bg-card"
                style={{ borderColor: "hsl(var(--background))" }}
              >
                <Camera className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left pb-5 sm:pb-4">
              <h2 className="text-xl font-bold text-primary-foreground">
                {saved.name} <span className="text-base font-normal opacity-80">({saved.nickname})</span>
              </h2>
              <p className="text-sm text-primary-foreground/80 mt-0.5">{saved.position}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2 justify-center sm:justify-start">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-foreground/20 text-primary-foreground">
                  <Building2 className="w-3 h-3" /> {saved.department}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: "hsl(0 84% 60%)", color: "#fff" }}>
                  <Shield className="w-3 h-3" /> {saved.role}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-foreground/20 text-primary-foreground">
                  <Award className="w-3 h-3" /> {saved.level}
                </span>
              </div>
            </div>

            {/* Edit button */}
            <div className="pb-5 sm:pb-4">
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30 transition-colors"
                >
                  <FileText className="w-4 h-4" /> แก้ไขข้อมูล
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="mt-6 bg-card/95 backdrop-blur-sm rounded-t-none">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
            {stats.map((s, i) => (
              <div key={i} className="text-center py-4 px-3">
                <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Sidebar nav */}
        <div className="lg:w-56 flex-shrink-0">
          <div className="card-base p-2 space-y-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                  style={{
                    background: isActive ? "hsl(var(--primary))" : "transparent",
                    color: isActive ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                    boxShadow: isActive ? "0 4px 12px hsl(var(--primary) / 0.3)" : "none",
                  }}
                >
                  <tab.icon className="w-4 h-4 flex-shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content panel */}
        <div className="flex-1 card-base p-5 min-w-0">
          {/* ข้อมูลส่วนตัว */}
          {activeTab === "personal" && (
            <div className="space-y-5">
              <h3 className="text-base font-bold">ข้อมูลส่วนตัว</h3>
              {isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <EditField label="ชื่อ-นามสกุล" value={form.name} onChange={(v) => setForm(p => ({ ...p, name: v }))} />
                  <EditField label="ชื่อเล่น" value={form.nickname} onChange={(v) => setForm(p => ({ ...p, nickname: v }))} />
                  <EditField label="อีเมล" value={form.email} onChange={(v) => setForm(p => ({ ...p, email: v }))} />
                  <EditField label="เบอร์โทรศัพท์" value={form.phone} onChange={(v) => setForm(p => ({ ...p, phone: v }))} />
                  <EditField label="Line ID" value={form.lineId} onChange={(v) => setForm(p => ({ ...p, lineId: v }))} />
                  <EditField label="วันเกิด" value={form.birthDate} onChange={(v) => setForm(p => ({ ...p, birthDate: v }))} />
                  <EditField label="เพศ" value={form.gender} onChange={(v) => setForm(p => ({ ...p, gender: v }))} />
                  <EditField label="สัญชาติ" value={form.nationality} onChange={(v) => setForm(p => ({ ...p, nationality: v }))} />
                  <EditField label="ศาสนา" value={form.religion} onChange={(v) => setForm(p => ({ ...p, religion: v }))} />
                  <EditField label="เลขบัตรประชาชน" value={form.idCard} onChange={(v) => setForm(p => ({ ...p, idCard: v }))} />
                  <EditField label="ที่อยู่" value={form.address} onChange={(v) => setForm(p => ({ ...p, address: v }))} />
                  <EditField label="รหัสพนักงาน" value={form.employeeId} onChange={() => {}} disabled />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <ReadField icon={User} label="ชื่อ-นามสกุล" value={form.name} />
                  <ReadField icon={User} label="ชื่อเล่น" value={form.nickname} />
                  <ReadField icon={Mail} label="อีเมล" value={form.email} />
                  <ReadField icon={Phone} label="เบอร์โทรศัพท์" value={form.phone} />
                  <ReadField icon={Hash} label="Line ID" value={form.lineId} />
                  <ReadField icon={Calendar} label="วันเกิด" value={form.birthDate} />
                  <ReadField icon={User} label="เพศ" value={form.gender} />
                  <ReadField icon={MapPin} label="สัญชาติ" value={form.nationality} />
                  <ReadField icon={Heart} label="ศาสนา" value={form.religion} />
                  <ReadField icon={Shield} label="เลขบัตรประชาชน" value={form.idCard} />
                  <ReadField icon={MapPin} label="ที่อยู่" value={form.address} />
                  <ReadField icon={Hash} label="รหัสพนักงาน" value={form.employeeId} />
                </div>
              )}
              {isEditing && (
                <div className="flex gap-3 pt-2">
                  <button onClick={handleSave} disabled={!isDirty} className="px-6 py-2.5 rounded-xl text-sm font-bold text-primary-foreground disabled:opacity-50" style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))" }}>บันทึก</button>
                  <button onClick={handleCancel} className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted">ยกเลิก</button>
                </div>
              )}
            </div>
          )}

          {/* ข้อมูลการทำงาน */}
          {activeTab === "work" && (
            <div className="space-y-5">
              <h3 className="text-base font-bold">ข้อมูลการทำงาน</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <ReadField icon={Hash} label="รหัสพนักงาน" value={saved.employeeId} />
                <ReadField icon={Briefcase} label="ตำแหน่ง" value={saved.position} />
                <ReadField icon={Building2} label="แผนก" value={saved.department} />
                <ReadField icon={Shield} label="บทบาท" value={saved.role} />
                <ReadField icon={Award} label="ระดับ" value={saved.level} />
                <ReadField icon={Calendar} label="วันเริ่มงาน" value={saved.startDate} />
                <ReadField icon={Hash} label="Face Scan ID" value={saved.faceScanId} />
                <ReadField icon={Calendar} label="อายุงาน" value={`${saved.yearsWorked} ปี`} />
              </div>
            </div>
          )}

          {/* ข้อมูลครอบครัว */}
          {activeTab === "family" && (
            <div className="space-y-5">
              <h3 className="text-base font-bold">ข้อมูลครอบครัว</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <ReadField icon={Heart} label="คู่สมรส" value={saved.spouseName} />
                <ReadField icon={Users} label="จำนวนบุตร" value={String(saved.childrenCount)} />
                <ReadField icon={Phone} label="ผู้ติดต่อฉุกเฉิน" value={saved.emergencyContact} />
              </div>
            </div>
          )}

          {/* ประวัติการศึกษา */}
          {activeTab === "education" && (
            <div className="space-y-5">
              <h3 className="text-base font-bold">ประวัติการศึกษา</h3>
              <div className="card-base p-4 space-y-3 border border-border">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ReadField icon={GraduationCap} label="ระดับการศึกษา" value={saved.educationLevel} />
                  <ReadField icon={Building2} label="สถาบัน" value={saved.institution} />
                  <ReadField icon={FileText} label="สาขา" value={saved.major} />
                  <ReadField icon={Calendar} label="ปีที่จบ" value={saved.graduationYear} />
                </div>
              </div>
            </div>
          )}

          {/* ประวัติการทำงาน */}
          {activeTab === "workhistory" && (
            <div className="space-y-5">
              <h3 className="text-base font-bold">ประวัติการทำงาน</h3>
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <History className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">ยังไม่มีประวัติการทำงานก่อนหน้า</p>
              </div>
            </div>
          )}

          {/* ความปลอดภัย */}
          {activeTab === "security" && (
            <div className="space-y-5">
              <h3 className="text-base font-bold">เปลี่ยนรหัสผ่าน</h3>
              <div className="max-w-md space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">รหัสผ่านปัจจุบัน</label>
                  <div className="relative">
                    <input
                      type={showOldPw ? "text" : "password"}
                      value={pwForm.oldPassword}
                      onChange={(e) => setPwForm(p => ({ ...p, oldPassword: e.target.value }))}
                      className="w-full px-3 py-2.5 pr-10 text-sm rounded-xl border outline-none bg-muted/30"
                      placeholder="รหัสผ่านปัจจุบัน"
                    />
                    <button type="button" onClick={() => setShowOldPw(!showOldPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showOldPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">รหัสผ่านใหม่</label>
                  <div className="relative">
                    <input
                      type={showNewPw ? "text" : "password"}
                      value={pwForm.newPassword}
                      onChange={(e) => setPwForm(p => ({ ...p, newPassword: e.target.value }))}
                      className="w-full px-3 py-2.5 pr-10 text-sm rounded-xl border outline-none bg-muted/30"
                      placeholder="รหัสผ่านใหม่"
                    />
                    <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">ยืนยันรหัสผ่านใหม่</label>
                  <input
                    type="password"
                    value={pwForm.confirmPassword}
                    onChange={(e) => setPwForm(p => ({ ...p, confirmPassword: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-muted/30"
                    placeholder="ยืนยันรหัสผ่านใหม่"
                  />
                </div>
                <button
                  onClick={handleChangePassword}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-primary-foreground"
                  style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))", boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}
                >
                  เปลี่ยนรหัสผ่าน
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
