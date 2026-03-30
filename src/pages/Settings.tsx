import { useState, useEffect } from "react";
import { Building2, MapPin, Shield, Clock, Calendar, Workflow, ScanFace, Palette, Banknote, FileSignature, ToggleRight, ChevronRight, Network } from "lucide-react";
import { useModuleSettings } from "@/hooks/useModuleSettings";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import LocationsSettings from "@/components/settings/LocationsSettings";
import RolesSettings from "@/components/settings/RolesSettings";
import ShiftsSettings from "@/components/settings/ShiftsSettings";
import LeaveTypesSettings from "@/components/settings/LeaveTypesSettings";
import CompanySettings from "@/components/settings/CompanySettings";
import ApprovalSettings from "@/components/settings/ApprovalSettings";
import FaceScannerSettings from "@/components/settings/FaceScannerSettings";
import DisplaySettings from "@/components/settings/DisplaySettings";
import PayrollSettings from "@/components/settings/PayrollSettings";
import ContractSettings from "@/components/settings/ContractSettings";
import ModuleSettings from "@/components/settings/ModuleSettings";
import AffiliationSettings from "@/components/settings/AffiliationSettings";

const ALL_TABS = [
  { id: "company", label: "ข้อมูลบริษัท", icon: Building2 },
  { id: "affiliations", label: "จัดการสังกัด", icon: Network },
  { id: "locations", label: "พื้นที่เข้างาน", icon: MapPin, requireModule: "check-in" },
  { id: "roles", label: "สิทธิ์ผู้ใช้งาน", icon: Shield },
  { id: "shifts", label: "กะการทำงาน", icon: Clock },
  { id: "payroll", label: "ตั้งค่าเงินเดือน", icon: Banknote },
  { id: "modules", label: "ตั้งค่าโมดูล", icon: ToggleRight },
  { id: "contracts", label: "สัญญาจ้าง", icon: FileSignature },
  { id: "leave-types", label: "ประเภทการลา", icon: Calendar },
  { id: "approval", label: "ระบบอนุมัติ", icon: Workflow },
  { id: "face-scanner", label: "เครื่องสแกนหน้า", icon: ScanFace },
  { id: "display", label: "การแสดงผล", icon: Palette },
];





const Settings = () => {
  const [activeTab, setActiveTab] = useState("company");
  const isMobile = useIsMobile();

  const { modules: moduleSettings } = useModuleSettings();

  const tabs = ALL_TABS.filter((tab) => {
    if ('requireModule' in tab && tab.requireModule) {
      return moduleSettings[tab.requireModule] !== false;
    }
    return true;
  });

  // If active tab got hidden, switch to first available
  useEffect(() => {
    if (!tabs.find(t => t.id === activeTab)) {
      setActiveTab(tabs[0]?.id || "company");
    }
  }, [tabs, activeTab]);

  const renderContent = () => {
    switch (activeTab) {
      case "company":
        return <CompanySettings />;
      case "affiliations":
        return <AffiliationSettings />;

      case "locations":
        return <LocationsSettings />;

      case "roles":
        return <RolesSettings />;

      case "shifts":
        return <ShiftsSettings />;

      case "leave-types":
        return <LeaveTypesSettings />;

      case "approval":
        return <ApprovalSettings />;

      case "face-scanner":
        return <FaceScannerSettings />;

      case "display":
        return <DisplaySettings />;

      case "payroll":
        return <PayrollSettings />;

      case "contracts":
        return <ContractSettings />;

      case "modules":
        return <ModuleSettings />;

      default:
        return null;
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold font-display">ตั้งค่าระบบ</h2>
        <p className="text-sm text-muted-foreground mt-0.5">กำหนดค่าระบบ บริษัท สิทธิ์ และการทำงาน</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Tab nav */}
        <div className="lg:w-56 flex-shrink-0 lg:sticky lg:top-4 lg:self-start">
          {isMobile ? (
            /* Mobile: icon-only tabs in a single row */
            <div className="card-base p-2 flex justify-between">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <Tooltip key={tab.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setActiveTab(tab.id)}
                        className="flex items-center justify-center w-9 h-9 rounded-xl transition-all"
                        style={{
                          background: isActive ? "hsl(var(--primary))" : "transparent",
                          color: isActive ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                          boxShadow: isActive ? "0 4px 12px hsl(var(--primary) / 0.3)" : "none",
                        }}
                      >
                        <tab.icon className="w-4.5 h-4.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {tab.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ) : (
            /* Desktop: full sidebar nav */
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
                    <span className="flex-1">{tab.label}</span>
                    {isActive && <ChevronRight className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 card-base p-5 min-w-0">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default Settings;
