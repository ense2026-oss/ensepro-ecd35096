import { useState, useEffect, useRef, useMemo } from "react";
import { Search, Bell, ChevronDown, Settings, User, LogOut, Menu, MapPin, Clock, CalendarDays, Users, FileText, LayoutDashboard, GitBranch } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePendingCounts } from "@/contexts/PendingCountsContext";
import { useTimeEditRequests } from "@/contexts/TimeEditContext";

interface TopbarProps {
  onMenuToggle?: () => void;
  pageTitle?: string;
  pageSubtitle?: string;
}

const Topbar = ({ onMenuToggle, pageTitle = "Dashboard", pageSubtitle = "ภาพรวมระบบ HR" }: TopbarProps) => {
  const navigate = useNavigate();
  const { currentUser, hasAdminAccess, logout } = useAuth();
  const { setNotificationCount } = usePendingCounts();
  const [showProfile, setShowProfile] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Demo searchable items
  const searchableItems = [
    { label: "Dashboard", description: "ภาพรวมระบบ HR", path: "/dashboard", category: "เมนู", icon: LayoutDashboard },
    { label: "พนักงาน", description: "จัดการข้อมูลพนักงาน", path: "/employees", category: "เมนู", icon: Users },
    { label: "โครงสร้างองค์กร", description: "แผนผังแผนกและตำแหน่ง", path: "/organization", category: "เมนู", icon: GitBranch },
    { label: "เวลาเข้าออกงาน", description: "บันทึกเวลาทำงาน", path: "/attendance", category: "เมนู", icon: Clock },
    { label: "ลางาน", description: "จัดการคำขอลาและโควต้า", path: "/leave", category: "เมนู", icon: CalendarDays },
    { label: "โอที", description: "คำขอทำงานล่วงเวลา", path: "/overtime", category: "เมนู", icon: Clock },
    { label: "รายงาน", description: "สรุปและส่งออกรายงาน", path: "/reports", category: "เมนู", icon: FileText },
    { label: "ตั้งค่าระบบ", description: "กำหนดค่าระบบ บริษัท สิทธิ์", path: "/settings", category: "เมนู", icon: Settings },
    { label: "สมชาย ใจดี", description: "พนักงาน · แผนก IT", path: "/employees", category: "พนักงาน", icon: User },
    { label: "นภา สดใส", description: "พนักงาน · แผนก HR", path: "/employees", category: "พนักงาน", icon: User },
    { label: "วิชัย เก่งกาจ", description: "พนักงาน · แผนก Sales", path: "/employees", category: "พนักงาน", icon: User },
    { label: "ประภาส มั่นคง", description: "พนักงาน · แผนก Finance", path: "/employees", category: "พนักงาน", icon: User },
    { label: "สมหญิง รักงาน", description: "พนักงาน · แผนก HR", path: "/employees", category: "พนักงาน", icon: User },
  ];

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return searchableItems.filter(
      (item) => item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { notifications: sharedNotifs, markNotifRead } = useTimeEditRequests();

  // Sync unread count to pending counts context
  useEffect(() => {
    setNotificationCount(sharedNotifs.filter((n) => !n.read).length);
  }, [sharedNotifs, setNotificationCount]);

  // Take latest 5 unread/recent notifications for the bell dropdown
  const topNotifs = sharedNotifs.slice(0, 5).map((n) => ({
    id: n.id,
    text: `${n.title}: ${n.description}`.slice(0, 60),
    time: n.time,
    unread: !n.read,
    link: n.type === "attendance" ? "/attendance" : n.type === "leave" ? "/leave" : n.type === "ot" ? "/overtime" : "/notifications",
  }));

  const unreadCount = sharedNotifs.filter((n) => !n.read).length;

  const handleNotificationClick = (id: string, link: string) => {
    markNotifRead(id);
    setShowNotif(false);
    navigate(link);
  };

  return (
    <header
      className="h-16 flex items-center justify-between px-4 lg:px-6 border-b z-30 relative"
      style={{
        background: "hsl(var(--topbar-background))",
        borderColor: "hsl(var(--topbar-border))",
      }}
    >
      {/* Left: Menu + Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-bold font-display leading-tight">{pageTitle}</h1>
          <p className="text-xs text-muted-foreground leading-tight hidden sm:block">{pageSubtitle}</p>
        </div>
      </div>

      {/* Center: Search - hidden on mobile/iPad */}
      <div className="hidden lg:flex items-center flex-1 max-w-md mx-6">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="ค้นหาพนักงาน, แผนก, รายการ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowSearch(true)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border bg-muted/50 outline-none focus:ring-2 transition-all"
            style={{
              borderColor: "hsl(var(--border))",
            }}
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
            ⌘K
          </kbd>
          {/* Search results dropdown */}
          {showSearch && searchQuery.trim().length > 0 && (
            <div
              ref={searchRef}
              className="absolute left-0 right-0 top-full mt-2 rounded-xl border overflow-hidden z-50"
              style={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              }}
            >
              <div className="max-h-72 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">ไม่พบผลลัพธ์</div>
                ) : (
                  searchResults.map((r) => (
                    <button
                      key={r.path}
                      onClick={() => { navigate(r.path); setShowSearch(false); setSearchQuery(""); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b last:border-b-0"
                      style={{ borderColor: "hsl(var(--border))" }}
                    >
                      <r.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.description}</p>
                      </div>
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ml-auto"
                        style={{ background: "hsl(var(--muted))" }}
                      >
                        {r.category}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Check-in Button */}
        <button
          onClick={() => navigate("/check-in")}
          className="flex items-center gap-2 px-2.5 lg:px-3 py-2 rounded-xl text-sm font-bold text-primary-foreground transition-all hover:opacity-90"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary)), hsl(31 100% 60%))",
            boxShadow: "0 2px 8px hsl(var(--primary) / 0.3)",
          }}
          title="ลงเวลา"
        >
          <MapPin className="w-4 h-4" />
          <span className="hidden lg:inline">ลงเวลา</span>
        </button>

        {/* Notification */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setShowNotif(!showNotif); setShowProfile(false); }}
            className="relative p-2 rounded-xl hover:bg-muted transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span
                className="absolute top-1 right-1 w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center"
                style={{ background: "#FF870F", color: "#fff", fontSize: "9px" }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {showNotif && (
            <div
              className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-16 sm:top-12 w-auto sm:w-80 rounded-2xl border overflow-hidden z-50 animate-scale-in"
              style={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              }}
            >
              <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "hsl(var(--border))" }}>
                <h3 className="font-bold text-sm">การแจ้งเตือน</h3>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "hsl(31 100% 95%)", color: "#FF870F" }}>
                  {unreadCount} ใหม่
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {unreadCount === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">ไม่มีการแจ้งเตือนใหม่</div>
                ) : (
                  topNotifs.filter((n) => n.unread).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n.id, n.link)}
                      className="p-4 border-b hover:bg-muted/50 cursor-pointer transition-colors"
                      style={{ borderColor: "hsl(var(--border))", background: "hsl(31 100% 98%)" }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: "#FF870F" }} />
                        <div>
                          <p className="text-sm font-medium">{n.text}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{n.time}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-3 text-center border-t" style={{ borderColor: "hsl(var(--border))" }}>
                <button
                  onClick={() => { setShowNotif(false); navigate("/notifications"); }}
                  className="text-xs font-medium" style={{ color: "#FF870F" }}
                >
                  ดูทั้งหมด
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => { setShowProfile(!showProfile); setShowNotif(false); }}
            className="flex items-center gap-2 p-1.5 pr-3 rounded-xl hover:bg-muted transition-colors"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{ background: currentUser ? currentUser.avatarColor : "linear-gradient(135deg, #FF870F, #FF9A3C)", color: currentUser?.avatarTextColor || "#fff" }}
            >
              {currentUser?.avatar || "AD"}
            </div>
            <div className="hidden sm:block text-left max-w-[100px] lg:max-w-[140px]">
              <p className="text-xs font-semibold leading-tight truncate">{currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "Admin User"}</p>
              <p className="text-[10px] text-muted-foreground leading-tight truncate">{currentUser?.role || "Administrator"}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
          </button>

          {showProfile && (
            <div
              className="absolute right-0 top-12 w-56 rounded-2xl border overflow-hidden z-50 animate-scale-in"
              style={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              }}
            >
              <div className="p-4 border-b" style={{ borderColor: "hsl(var(--border))" }}>
                <p className="font-semibold text-sm">{currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "Admin User"}</p>
                <p className="text-xs text-muted-foreground">{currentUser?.email || "admin@company.com"}</p>
              </div>
              <div className="p-2">
                {[
                  { icon: User, label: "โปรไฟล์", path: currentUser ? `/employees/${currentUser.id}` : "/profile", show: true },
                  { icon: Settings, label: "ตั้งค่า", path: "/settings", show: hasAdminAccess },
                ].filter((item) => item.show).map((item) => (
                  <button
                    key={item.label}
                    onClick={() => { navigate(item.path); setShowProfile(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-muted transition-colors"
                  >
                    <item.icon className="w-4 h-4 text-muted-foreground" />
                    {item.label}
                  </button>
                ))}
                <div className="border-t my-2" style={{ borderColor: "hsl(var(--border))" }} />
                <button
                  onClick={() => { logout(); navigate("/login"); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-destructive/10 transition-colors"
                  style={{ color: "hsl(var(--destructive))" }}
                >
                  <LogOut className="w-4 h-4" />
                  ออกจากระบบ
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
