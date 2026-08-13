import { useState, useEffect } from "react";
import { Building2, MapPin, Shield, Clock, Calendar, Workflow, ScanFace, Palette, Banknote, FileSignature, ToggleRight, ChevronRight, Network, Wifi, CalendarDays, ShieldCheck } from "lucide-react";
import { useModuleSettings } from "@/hooks/useModuleSettings";
import { useIsMobile } from "@/hooks/use-mobile";
import { Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { SETTINGS_TAB_TO_MODULE } from "@/lib/settingsModules";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";

import LocationsSettings from "@/components/settings/LocationsSettings";
import RolesSettings from "@/components/settings/RolesSettings";
import AdminsSettings from "@/components/settings/AdminsSettings";
import ShiftsSettings from "@/components/settings/ShiftsSettings";
import LeaveTypesSettings from "@/components/settings/LeaveTypesSettings";
import CompanySettings from "@/components/settings/CompanySettings";
import ApprovalSettings from "@/components/settings/ApprovalSettings";
import FaceScanConnectionSettings from "@/components/settings/FaceScanConnectionSettings";
import DisplaySettings from "@/components/settings/DisplaySettings";
import PayrollSettings from "@/components/settings/PayrollSettings";
import ContractSettings from "@/components/settings/ContractSettings";
import ModuleSettings from "@/components/settings/ModuleSettings";
import AffiliationSettings from "@/components/settings/AffiliationSettings";
import CompanyHolidaysSettings from "@/components/settings/CompanyHolidaysSettings";
import EmployeeFieldOptionsSettings from "@/components/settings/EmployeeFieldOptionsSettings";

const ALL_TABS = [
  { id: "company", label: "ข้อมูลบริษัท", icon: Building2 },
  { id: "affiliations", label: "จัดการแผนก", icon: Network },
  { id: "locations", label: "พื้นที่เข้างาน", icon: MapPin, requireModule: "check-in" },
  { id: "roles", label: "สิทธิ์ผู้ใช้งาน", icon: Shield },
  { id: "admins", label: "ผู้ดูแลระบบ", icon: ShieldCheck },
  { id: "shifts", label: "กะการทำงาน", icon: Clock },
  { id: "payroll", label: "ตั้งค่าเงินเดือน", icon: Banknote },
  { id: "modules", label: "ตั้งค่าโมดูล", icon: ToggleRight },
  { id: "leave-types", label: "ประเภทการลา", icon: Calendar },
  { id: "company-holidays", label: "วันหยุดบริษัท", icon: CalendarDays },
  { id: "approval", label: "ระบบอนุมัติ", icon: Workflow },
  { id: "face-scan-connect", label: "เครื่องสแกนหน้า", icon: ScanFace },
  { id: "display", label: "การแสดงผล", icon: Palette },
];





const Settings = () => {
  const [activeTab, setActiveTab] = useState("company");
  const isMobile = useIsMobile();

  const { modules: moduleSettings } = useModuleSettings();
  const { role } = useAuth();
  const { canAction, loading: permsLoading } = usePermissions();

  const tabs = ALL_TABS.filter((tab) => {
    if ('requireModule' in tab && tab.requireModule) {
      if (moduleSettings[tab.requireModule] === false) return false;
    }
    // Per-tab view permission (allow while permissions still loading)
    const mod = SETTINGS_TAB_TO_MODULE[tab.id];
    if (mod && !permsLoading && !canAction(role, mod, "view")) return false;
    return true;
  });

  const activeModule = SETTINGS_TAB_TO_MODULE[activeTab];
  const canEditActiveTab = !activeModule || canAction(role, activeModule, "edit");


  // If active tab got hidden, switch to first available
  useEffect(() => {
    if (!tabs.find(t => t.id === activeTab)) {
      setActiveTab(tabs[0]?.id || "company");
    }
  }, [tabs, activeTab]);

  const renderContent = () => {
    switch (activeTab) {
      case "company":
        return (
          <div className="space-y-8">
            <CompanySettings />
            <div className="border-t pt-6">
              <EmployeeFieldOptionsSettings />
            </div>
          </div>
        );
      case "affiliations":
        return <AffiliationSettings />;

      case "locations":
        return <LocationsSettings />;

      case "roles":
        return <RolesSettings />;

      case "admins":
        return <AdminsSettings />;

      case "shifts":
        return <ShiftsSettings />;

      case "leave-types":
        return <LeaveTypesSettings />;

      case "company-holidays":
        return <CompanyHolidaysSettings />;

      case "approval":
        return <ApprovalSettings />;

      case "face-scan-connect":
        return <FaceScanConnectionSettings />;

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
          {!canEditActiveTab && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl text-sm bg-muted/50 text-muted-foreground border border-dashed" style={{ borderColor: "hsl(var(--border))" }}>
              <Lock className="w-4 h-4 flex-shrink-0" />
              <span>คุณมีสิทธิ์ <span className="font-semibold">ดูอย่างเดียว</span> ในแท็บนี้ — ไม่สามารถแก้ไขได้</span>
            </div>
          )}
          <fieldset disabled={!canEditActiveTab} className={`min-w-0 w-full border-0 p-0 m-0${!canEditActiveTab ? " opacity-90" : ""}`}>
            {renderContent()}
          </fieldset>

        </div>

      </div>
    </div>
  );
};

export default Settings;
