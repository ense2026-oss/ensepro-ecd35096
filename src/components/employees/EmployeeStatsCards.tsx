import { Users, UserCheck, UserX, Building2 } from "lucide-react";

interface EmployeeStatsProps {
  total: number;
  active: number;
  onLeave: number;
  inactive: number;
  departments: number;
}

const EmployeeStatsCards = ({ total, active, onLeave, inactive, departments }: EmployeeStatsProps) => {
  const stats = [
    {
      label: "พนักงานทั้งหมด",
      value: total,
      icon: Users,
      gradient: "from-primary/15 to-primary/5",
      iconBg: "bg-primary/15",
      iconColor: "text-primary",
      valueColor: "text-primary",
    },
    {
      label: "ทำงานอยู่",
      value: active,
      icon: UserCheck,
      gradient: "from-emerald-500/15 to-emerald-500/5",
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-600",
      valueColor: "text-emerald-600",
    },
    {
      label: "ลางาน",
      value: onLeave,
      icon: UserX,
      gradient: "from-amber-500/15 to-amber-500/5",
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-600",
      valueColor: "text-amber-600",
    },
    {
      label: "แผนกทั้งหมด",
      value: departments,
      icon: Building2,
      gradient: "from-violet-500/15 to-violet-500/5",
      iconBg: "bg-violet-500/15",
      iconColor: "text-violet-600",
      valueColor: "text-violet-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`card-base p-4 bg-gradient-to-br ${stat.gradient} relative overflow-hidden group hover:shadow-md transition-all duration-300`}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.valueColor}`}>{stat.value}</p>
            </div>
            <div className={`p-2.5 rounded-xl ${stat.iconBg} transition-transform group-hover:scale-110`}>
              <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
            </div>
          </div>
          {/* Decorative circle */}
          <div className={`absolute -bottom-4 -right-4 w-20 h-20 rounded-full ${stat.iconBg} opacity-30`} />
        </div>
      ))}
    </div>
  );
};

export default EmployeeStatsCards;
