import { useState } from "react";
import { Eye, EyeOff, Building2, Shield, UserPlus, LogIn } from "lucide-react";
import { Eye, EyeOff, Building2, Shield, UserPlus, LogIn } from "lucide-react";
import { useBranding } from "@/contexts/BrandingContext";
import { useAuth } from "@/contexts/AuthContext";

const floatingOrbs = [
  { size: 420, x: 60, y: -5, color: "#FF870F", opacity: 0.12, duration: 18, delay: 0 },
  { size: 350, x: -10, y: 70, color: "#87FF0F", opacity: 0.09, duration: 22, delay: 2 },
  { size: 280, x: 40, y: 40, color: "#FF870F", opacity: 0.07, duration: 25, delay: 5 },
  { size: 200, x: 80, y: 55, color: "#87FF0F", opacity: 0.06, duration: 20, delay: 8 },
  { size: 160, x: 25, y: 20, color: "#FF9A3C", opacity: 0.08, duration: 16, delay: 3 },
];

const particles = Array.from({ length: 250 }, (_, i) => {
  const rand = Math.random();
  const y = 100 - rand * rand * 50;
  const heightFactor = (y - 50) / 50;
  return {
    x: Math.random() * 100,
    y,
    size: Math.random() * 2 + 0.5 + heightFactor * 1.5,
    duration: Math.random() * 10 + 12,
    delay: Math.random() * 15,
    opacity: (Math.random() * 0.4 + 0.15) * (0.4 + heightFactor * 0.6),
    color: i % 3 === 0 ? "#FF870F" : i % 3 === 1 ? "#FF9A3C" : "#87FF0F",
  };
});

const Login = () => {
  const navigate = useNavigate();
  const { programName, programSubtitle, logoUrl, logoOnlyUrl, displayMode } = useBranding();
  const activeLogo = displayMode === "logo-only" ? logoOnlyUrl : logoUrl;
  const auth = useAuth();

  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim() || !password.trim()) {
      setError("กรุณากรอก Email และรหัสผ่าน");
      return;
    }

    if (isSignup && !fullName.trim()) {
      setError("กรุณากรอกชื่อ-นามสกุล");
      return;
    }

    setIsLoading(true);

    if (isSignup) {
      const { error: signupErr } = await auth.signup(email.trim(), password.trim(), fullName.trim());
      setIsLoading(false);
      if (signupErr) {
        setError(signupErr);
        return;
      }
      setSuccess("สมัครสมาชิกสำเร็จ! กำลังเข้าสู่ระบบ...");
      // Route guard (LoginRoute) will redirect once auth state updates
    } else {
      const { error: loginErr } = await auth.login(email.trim(), password.trim());
      setIsLoading(false);
      if (loginErr) {
        setError("Email หรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
        return;
      }
      // Route guard (LoginRoute) will redirect once auth state updates
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-dark relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0">
          {floatingOrbs.map((orb, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: orb.size, height: orb.size,
                left: `${orb.x}%`, top: `${orb.y}%`,
                background: `radial-gradient(circle, ${orb.color}, transparent 70%)`,
                opacity: orb.opacity,
                animation: `loginFloat${i} ${orb.duration}s ease-in-out ${orb.delay}s infinite`,
                filter: "blur(40px)", transform: "translate(-50%, -50%)",
              }}
            />
          ))}
        </div>

        <div className="absolute inset-0 pointer-events-none">
          {particles.map((p, i) => (
            <div
              key={`p-${i}`}
              className="absolute rounded-full"
              style={{
                width: p.size, height: p.size,
                left: `${p.x}%`, top: `${p.y}%`,
                backgroundColor: p.color, opacity: 0,
                animation: `sparkle ${p.duration}s ease-in-out ${p.delay}s infinite`,
                boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
              }}
            />
          ))}
        </div>

        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10">
          <div className={`flex items-center gap-3 mb-2 ${displayMode === "logo-only" ? "max-w-[180px]" : ""}`}>
            {activeLogo ? (
              <img
                src={activeLogo}
                alt="Logo"
                className={`flex-shrink-0 ${displayMode === "logo-only" ? "w-full max-h-20 object-contain rounded-xl" : "w-12 h-12 object-cover rounded-none"}`}
              />
            ) : (
              <div
                className={`flex items-center justify-center flex-shrink-0 ${displayMode === "logo-only" ? "w-20 h-20 rounded-xl" : "w-12 h-12 rounded-none"}`}
                style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))" }}
              >
                <Building2 className={`text-black ${displayMode === "logo-only" ? "w-12 h-12" : "w-7 h-7"}`} />
              </div>
            )}
            {displayMode === "logo-and-name" && (
              <div>
                <h1 className="text-white text-xl font-bold font-display">{programName}</h1>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{programSubtitle}</p>
              </div>
            )}
          </div>
        </div>

        <div className="relative z-10">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6"
            style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))", border: "1px solid hsl(var(--primary) / 0.3)" }}
          >
            <Shield className="w-4 h-4" />
            Secure Access Portal
          </div>
          <h2 className="text-4xl font-bold text-white font-display leading-tight mb-4">
            ระบบบริหาร<br />
            <span style={{ color: "hsl(var(--primary))" }}>จัดการพนักงาน</span>องค์กร
          </h2>
          <p className="text-lg leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.6)" }}>
            Human Resources & Organization Management System ครบวงจร ติดตามเวลา ลา OT และโครงสร้างองค์กร
          </p>
          <div className="flex flex-wrap gap-2">
            {["ระบบลางาน", "บันทึกเวลา", "โครงสร้างองค์กร", "รายงาน Excel/PDF", "GPS Check-in"].map((f) => (
              <span
                key={f}
                className="px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-4">
          {[
            { label: "พนักงาน", value: "500+" },
            { label: "แผนก", value: "24" },
            { label: "สาขา", value: "8" },
          ].map((s) => (
            <div
              key={s.label}
              className="text-center p-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <div className="text-2xl font-bold font-display" style={{ color: "hsl(var(--primary))" }}>{s.value}</div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel - Login/Signup Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            {activeLogo ? (
              <img
                src={activeLogo}
                alt="Logo"
                className={`rounded-xl object-cover ${displayMode === "logo-only" ? "w-20 h-20" : "w-10 h-10"}`}
              />
            ) : (
              <div
                className={`rounded-xl flex items-center justify-center ${displayMode === "logo-only" ? "w-20 h-20" : "w-10 h-10"}`}
                style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))" }}
              >
                <Building2 className={`text-black ${displayMode === "logo-only" ? "w-10 h-10" : "w-6 h-6"}`} />
              </div>
            )}
            {displayMode === "logo-and-name" && (
              <div>
                <h1 className="text-xl font-bold font-display">{programName}</h1>
                <p className="text-xs text-muted-foreground">{programSubtitle}</p>
              </div>
            )}
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold font-display mb-2">
              {isSignup ? "สร้างบัญชีใหม่ ✨" : "ยินดีต้อนรับ 👋"}
            </h2>
            <p className="text-muted-foreground">
              {isSignup ? "กรอกข้อมูลเพื่อสมัครเข้าใช้ระบบ" : "กรุณาเข้าสู่ระบบด้วย Email ของคุณ"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name (signup only) */}
            {isSignup && (
              <div>
                <label className="block text-sm font-semibold mb-2">ชื่อ-นามสกุล</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="สมชาย ใจดี"
                  className="w-full px-4 py-3 rounded-xl border text-sm transition-all duration-200 outline-none focus:ring-2"
                  style={{
                    background: "hsl(var(--card))",
                    borderColor: fullName ? "hsl(var(--primary))" : "hsl(var(--border))",
                    boxShadow: fullName ? "0 0 0 3px hsl(var(--primary) / 0.12)" : "none",
                    color: "hsl(var(--foreground))",
                  }}
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@company.com"
                className="w-full px-4 py-3 rounded-xl border text-sm transition-all duration-200 outline-none focus:ring-2"
                style={{
                  background: "hsl(var(--card))",
                  borderColor: email ? "hsl(var(--primary))" : "hsl(var(--border))",
                  boxShadow: email ? "0 0 0 3px hsl(var(--primary) / 0.12)" : "none",
                  color: "hsl(var(--foreground))",
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold mb-2">รหัสผ่าน</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  className="w-full px-4 py-3 pr-12 rounded-xl border text-sm transition-all duration-200 outline-none"
                  style={{
                    background: "hsl(var(--card))",
                    borderColor: password ? "hsl(var(--primary))" : "hsl(var(--border))",
                    boxShadow: password ? "0 0 0 3px hsl(var(--primary) / 0.12)" : "none",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember + Forgot (login only) */}
            {!isSignup && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded accent-primary" />
                  <span className="text-sm text-muted-foreground">จดจำการเข้าสู่ระบบ</span>
                </label>
                <button type="button" className="text-sm font-medium" style={{ color: "hsl(var(--primary))" }}>
                  ลืมรหัสผ่าน?
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 rounded-xl text-sm" style={{ background: "hsl(0 84% 95%)", color: "hsl(0 84% 40%)" }}>
                {error}
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="p-3 rounded-xl text-sm" style={{ background: "hsl(120 50% 95%)", color: "hsl(120 50% 30%)" }}>
                {success}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 animate-pulse-orange"
              style={{
                background: isLoading ? "hsl(var(--muted))" : "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))",
                color: isLoading ? "hsl(var(--muted-foreground))" : "hsl(var(--primary-foreground))",
                boxShadow: isLoading ? "none" : "0 4px 20px hsl(var(--primary) / 0.4)",
              }}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                  {isSignup ? "กำลังสมัคร..." : "กำลังเข้าสู่ระบบ..."}
                </>
              ) : (
                <>
                  {isSignup ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                  {isSignup ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
                </>
              )}
            </button>
          </form>

          {/* Toggle login/signup */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {isSignup ? "มีบัญชีอยู่แล้ว?" : "ยังไม่มีบัญชี?"}
              <button
                type="button"
                onClick={() => {
                  setIsSignup(!isSignup);
                  setError("");
                  setSuccess("");
                }}
                className="ml-2 font-semibold"
                style={{ color: "hsl(var(--primary))" }}
              >
                {isSignup ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
              </button>
            </p>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            © 2025 {programName}. ระบบบริหารจัดการพนักงานองค์กร
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
