import {
  Users,
  UserCheck,
  UserX,
  Clock,
  TrendingUp,
  TrendingDown,
  Calendar,
  Briefcase,
  AlertCircle,
  CheckCircle,
  MoreHorizontal,
  ArrowUpRight,
  MapPin,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";

// Mock data
const attendanceData = [
  { month: "ม.ค.", present: 142, absent: 8, late: 12 },
  { month: "ก.พ.", present: 138, absent: 12, late: 15 },
  { month: "มี.ค.", present: 150, absent: 5, late: 8 },
  { month: "เม.ย.", present: 145, absent: 9, late: 11 },
  { month: "พ.ค.", present: 148, absent: 7, late: 9 },
  { month: "มิ.ย.", present: 152, absent: 3, late: 6 },
  { month: "ก.ค.", present: 149, absent: 6, late: 10 },
  { month: "ส.ค.", present: 155, absent: 4, late: 7 },
  { month: "ก.ย.", present: 147, absent: 8, late: 14 },
  { month: "ต.ค.", present: 153, absent: 5, late: 9 },
  { month: "พ.ย.", present: 151, absent: 6, late: 8 },
  { month: "ธ.ค.", present: 144, absent: 10, late: 13 },
];

const leaveData = [
  { name: "ลาป่วย", value: 45, color: "#FF870F" },
  { name: "ลาพักร้อน", value: 88, color: "#87FF0F" },
  { name: "ลากิจ", value: 32, color: "#9CA3AF" },
  { name: "ลาอื่นๆ", value: 15, color: "#60a5fa" },
];

const recentActivity = [
  { id: 1, name: "สมชาย ใจดี", action: "ส่งคำขอลาป่วย", time: "10:32 น.", type: "leave", status: "pending" },
  { id: 2, name: "สมหญิง รักงาน", action: "เข้างานสาย 15 นาที", time: "09:15 น.", type: "late", status: "info" },
  { id: 3, name: "มานะ ขยัน", action: "ส่งคำขอ OT", time: "08:45 น.", type: "ot", status: "pending" },
  { id: 4, name: "สุดา ดีใจ", action: "เปลี่ยนรหัสผ่าน", time: "08:30 น.", type: "security", status: "success" },
  { id: 5, name: "วิชัย เก่งมาก", action: "อนุมัติลากิจ", time: "08:15 น.", type: "leave", status: "success" },
  { id: 6, name: "นิดา สุขใจ", action: "บันทึกเวลาเข้างาน", time: "08:02 น.", type: "attendance", status: "success" },
];

const topDepartments = [
  { dept: "ฝ่ายบัญชี", count: 24, present: 22 },
  { dept: "ฝ่ายขาย", count: 45, present: 40 },
  { dept: "ฝ่าย IT", count: 18, present: 17 },
  { dept: "ฝ่าย HR", count: 12, present: 12 },
  { dept: "ฝ่ายผลิต", count: 60, present: 54 },
];

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  trend?: { value: number; positive: boolean };
  color: string;
  bgColor: string;
}

const StatCard = ({ title, value, subtitle, icon: Icon, trend, color, bgColor }: StatCardProps) => (
  <div className="card-base p-3 sm:p-5 animate-fade-in">
    <div className="flex items-start justify-between mb-2 sm:mb-4">
      <div className="flex-1 min-w-0">
        <p className="text-[11px] sm:text-sm text-muted-foreground font-medium leading-tight">{title}</p>
        <p className="text-xl sm:text-3xl font-bold font-display mt-0.5 sm:mt-1" style={{ color }}>
          {value}
        </p>
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 leading-tight">{subtitle}</p>
      </div>
      <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bgColor }}>
        <Icon className="w-4 h-4 sm:w-6 sm:h-6" style={{ color }} />
      </div>
    </div>
    {trend && (
      <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
        {trend.positive ? (
          <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: "#87FF0F" }} />
        ) : (
          <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-destructive" />
        )}
        <span
          className="text-[10px] sm:text-xs font-semibold"
          style={{ color: trend.positive ? "hsl(90 100% 35%)" : "hsl(0 84% 50%)" }}
        >
          {trend.positive ? "+" : ""}
          {trend.value}%
        </span>
        <span className="text-[10px] sm:text-xs text-muted-foreground">จากเดือนที่แล้ว</span>
      </div>
    )}
  </div>
);

const Dashboard = () => {
  const { currentUser, hasAdminAccess } = useAuth();

  // Employee Dashboard - simplified personal view
  if (!hasAdminAccess && currentUser) {
    return (
      <div className="space-y-6">
        <div className="card-base p-6">
          <h2 className="text-xl font-bold font-display mb-1">
            สวัสดี, {currentUser.firstName} {currentUser.lastName} 👋
          </h2>
          <p className="text-sm text-muted-foreground">ยินดีต้อนรับเข้าสู่ระบบ HR</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatCard
            title="วันลาป่วยคงเหลือ"
            value="25"
            subtitle="ใช้ไป 5 / 30 วัน"
            icon={Calendar}
            color="#FF870F"
            bgColor="hsl(31 100% 93%)"
          />
          <StatCard
            title="วันลาพักร้อนคงเหลือ"
            value="7"
            subtitle="ใช้ไป 3 / 10 วัน"
            icon={Calendar}
            color="hsl(90 100% 35%)"
            bgColor="hsl(90 100% 92%)"
          />
          <StatCard
            title="OT เดือนนี้"
            value="12"
            subtitle="ชั่วโมง"
            icon={Clock}
            color="hsl(220 90% 50%)"
            bgColor="hsl(220 90% 93%)"
          />
          <StatCard
            title="เวลาเข้างานวันนี้"
            value="08:02"
            subtitle="ตรงเวลา ✓"
            icon={MapPin}
            color="hsl(90 100% 35%)"
            bgColor="hsl(90 100% 92%)"
          />
        </div>

        <div className="card-base p-5">
          <h3 className="font-bold font-display mb-4">กิจกรรมล่าสุดของฉัน</h3>
          <div className="space-y-3">
            {[
              { action: "ลงเวลาเข้างาน", time: "08:02 น.", status: "สำเร็จ" },
              { action: "ยื่นคำขอลากิจ", time: "เมื่อวาน", status: "รออนุมัติ" },
              { action: "ลงเวลาออกงาน", time: "เมื่อวาน 17:05 น.", status: "สำเร็จ" },
            ].map((act, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                <div>
                  <p className="text-sm font-medium">{act.action}</p>
                  <p className="text-xs text-muted-foreground">{act.time}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${act.status === "สำเร็จ" ? "badge-present" : "badge-late"}`}>
                  {act.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Admin Dashboard - full view
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="พนักงานทั้งหมด"
          value="248"
          subtitle="ใช้งานอยู่ 235 คน"
          icon={Users}
          trend={{ value: 3.2, positive: true }}
          color="#FF870F"
          bgColor="hsl(31 100% 93%)"
        />
        <StatCard
          title="มาทำงานวันนี้"
          value="221"
          subtitle="89.1% ของพนักงานทั้งหมด"
          icon={UserCheck}
          trend={{ value: 2.1, positive: true }}
          color="hsl(90 100% 35%)"
          bgColor="hsl(90 100% 92%)"
        />
        <StatCard
          title="ลางานวันนี้"
          value="18"
          subtitle="7.2% ของพนักงานทั้งหมด"
          icon={Calendar}
          trend={{ value: 1.5, positive: false }}
          color="hsl(220 90% 50%)"
          bgColor="hsl(220 90% 93%)"
        />
        <StatCard
          title="มาสายวันนี้"
          value="9"
          subtitle="3.6% ของพนักงานทั้งหมด"
          icon={Clock}
          trend={{ value: 0.8, positive: false }}
          color="hsl(0 84% 55%)"
          bgColor="hsl(0 84% 95%)"
        />
      </div>

      {/* Second row stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="OT วันนี้"
          value="14"
          subtitle="รวม 42 ชั่วโมง"
          icon={Briefcase}
          color="hsl(0 0% 45%)"
          bgColor="hsl(0 0% 92%)"
        />
        <StatCard
          title="รออนุมัติ"
          value="7"
          subtitle="คำขอลาและ OT"
          icon={AlertCircle}
          color="#FF870F"
          bgColor="hsl(31 100% 93%)"
        />
        <StatCard
          title="อนุมัติวันนี้"
          value="12"
          subtitle="รายการสำเร็จแล้ว"
          icon={CheckCircle}
          color="hsl(90 100% 35%)"
          bgColor="hsl(90 100% 92%)"
        />
        <StatCard
          title="พนักงานใหม่"
          value="3"
          subtitle="เดือนนี้"
          icon={UserX}
          trend={{ value: 50, positive: true }}
          color="hsl(220 90% 50%)"
          bgColor="hsl(220 90% 93%)"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Chart */}
        <div className="card-base p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold font-display">สถิติการเข้างาน</h3>
              <p className="text-xs text-muted-foreground mt-0.5">รายงานประจำปี 2568</p>
            </div>
            <button className="text-xs font-medium px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors">
              ดูรายงาน <ArrowUpRight className="w-3 h-3 inline ml-1" />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={attendanceData} barGap={2} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  fontSize: "12px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                }}
              />
              <Bar dataKey="present" name="มาทำงาน" fill="#87FF0F" radius={[4, 4, 0, 0]} />
              <Bar dataKey="late" name="มาสาย" fill="#FF870F" radius={[4, 4, 0, 0]} />
              <Bar dataKey="absent" name="ขาดงาน" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-6 mt-3 justify-center">
            {[
              { label: "มาทำงาน", color: "#87FF0F" },
              { label: "มาสาย", color: "#FF870F" },
              { label: "ขาดงาน", color: "#ef4444" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
                <span className="text-xs text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Leave Pie Chart */}
        <div className="card-base p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold font-display">สรุปการลา</h3>
              <p className="text-xs text-muted-foreground mt-0.5">เดือนนี้ รวม 180 วัน</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={leaveData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
              >
                {leaveData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {leaveData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                  <span className="text-xs text-muted-foreground">{item.name}</span>
                </div>
                <span className="text-xs font-semibold">{item.value} วัน</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card-base p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold font-display">กิจกรรมล่าสุด</h3>
            <button className="text-xs font-medium" style={{ color: "#FF870F" }}>
              ดูทั้งหมด
            </button>
          </div>
          <div className="space-y-3">
            {recentActivity.map((act) => (
              <div key={act.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{
                    background:
                      act.status === "success"
                        ? "hsl(90 100% 92%)"
                        : act.status === "pending"
                        ? "hsl(31 100% 93%)"
                        : "hsl(220 90% 93%)",
                    color:
                      act.status === "success"
                        ? "hsl(90 100% 30%)"
                        : act.status === "pending"
                        ? "#FF870F"
                        : "hsl(220 90% 40%)",
                  }}
                >
                  {act.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight truncate">{act.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{act.action}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">{act.time}</span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      act.status === "success"
                        ? "badge-present"
                        : act.status === "pending"
                        ? "badge-late"
                        : "badge-leave"
                    }`}
                  >
                    {act.status === "success" ? "สำเร็จ" : act.status === "pending" ? "รออนุมัติ" : "ข้อมูล"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Department Status */}
        <div className="card-base p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold font-display">สถิติตามแผนก</h3>
            <button className="text-xs font-medium" style={{ color: "#FF870F" }}>
              ดูทั้งหมด
            </button>
          </div>
          <div className="space-y-4">
            {topDepartments.map((dept) => {
              const percentage = Math.round((dept.present / dept.count) * 100);
              return (
                <div key={dept.dept}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium">{dept.dept}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {dept.present}/{dept.count}
                      </span>
                      <span
                        className="text-xs font-bold"
                        style={{ color: percentage >= 90 ? "hsl(90 100% 35%)" : "#FF870F" }}
                      >
                        {percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        background:
                          percentage >= 90
                            ? "linear-gradient(90deg, #87FF0F, #5ce600)"
                            : "linear-gradient(90deg, #FF870F, #FF9A3C)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick OT Summary */}
          <div
            className="mt-5 p-4 rounded-xl"
            style={{ background: "hsl(var(--muted))" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">OT สะสมเดือนนี้</p>
                <p className="text-xs text-muted-foreground mt-0.5">อัปเดตล่าสุด: วันนี้ 10:30 น.</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold font-display" style={{ color: "#FF870F" }}>
                  342
                </p>
                <p className="text-xs text-muted-foreground">ชั่วโมง</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
