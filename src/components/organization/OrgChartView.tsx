import { useMemo } from "react";
import { Building2, Network, Users } from "lucide-react";
import { type Affiliation, type Position, type OrgLevel } from "@/contexts/OrgContext";
import { type Employee } from "@/contexts/EmployeeContext";
import EmployeeAvatarShared from "@/components/ui/employee-avatar";

/* ═══════ Types ═══════ */
interface OrgChartViewProps {
  programName: string;
  orgLevels: OrgLevel[];
  affiliations: Affiliation[];
  positionEmployeeMap: Map<string, Employee[]>;
  orgLevelEmployeeMap: Map<string, Employee[]>;
  employees: Employee[];
}

/* ═══════ Mini Avatar ═══════ */
const ChartAvatar = ({ emp }: { emp: Employee }) => (
  <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-background shadow-sm flex-shrink-0">
    <EmployeeAvatarShared
      photoUrl={emp.photoUrl} avatar={emp.avatar}
      avatarColor={emp.avatarColor} avatarTextColor={emp.avatarTextColor}
      firstName={emp.firstName} size="xs" rounded="full"
      className="w-full h-full"
    />
  </div>
);

/* ═══════ Employee Cluster ═══════ */
const EmployeeCluster = ({ emps }: { emps: Employee[] }) => {
  if (!emps.length) return null;
  return (
    <div className="flex flex-col items-center gap-1.5 mt-2">
      <div className="flex -space-x-2 justify-center flex-wrap">
        {emps.slice(0, 5).map((emp) => (
          <ChartAvatar key={emp.id} emp={emp} />
        ))}
      </div>
      {emps.length <= 3 ? (
        <div className="text-[10px] text-muted-foreground text-center leading-tight">
          {emps.map((e) => `${e.firstName}`).join(", ")}
        </div>
      ) : (
        <div className="text-[10px] text-muted-foreground text-center">
          {emps[0].firstName} +{emps.length - 1} คน
        </div>
      )}
    </div>
  );
};

/* ═══════ Chart Node ═══════ */
const ChartNode = ({
  label, sublabel, variant = "default", employees: emps = [], icon: Icon,
}: {
  label: string;
  sublabel?: string;
  variant?: "root" | "orgLevel" | "affiliation" | "position" | "default";
  employees?: Employee[];
  icon?: React.ElementType;
}) => {
  const styles = {
    root: "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 min-w-[200px]",
    orgLevel: "bg-card border-primary/30 shadow-md min-w-[160px]",
    affiliation: "bg-card border-accent/50 shadow-md min-w-[150px]",
    position: "bg-card border-border shadow-sm min-w-[140px]",
    default: "bg-card border-border shadow-sm min-w-[140px]",
  };

  return (
    <div className={`relative inline-flex flex-col items-center px-4 py-3 rounded-2xl border-2 transition-all hover:scale-[1.02] ${styles[variant]}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className={`w-4 h-4 flex-shrink-0 ${variant === "root" ? "text-primary-foreground" : "text-primary"}`} />}
        <span className={`text-sm font-bold truncate max-w-[160px] ${variant === "root" ? "text-primary-foreground" : "text-foreground"}`}>{label}</span>
      </div>
      {sublabel && (
        <span className={`text-[10px] mt-0.5 ${variant === "root" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{sublabel}</span>
      )}
      <EmployeeCluster emps={emps} />
    </div>
  );
};

/* ═══════ Vertical Connector ═══════ */
const VLine = ({ height = 24 }: { height?: number }) => (
  <div className="flex justify-center">
    <div className="w-0.5 bg-border" style={{ height }} />
  </div>
);

/* ═══════ Branch Container (children with H-line) ═══════ */
const BranchContainer = ({ children }: { children: React.ReactNode[] }) => {
  if (!children || children.length === 0) return null;
  if (children.length === 1) {
    return (
      <div className="flex flex-col items-center">
        <VLine />
        {children[0]}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <VLine />
      {/* Horizontal connector line */}
      <div className="relative w-full">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 bg-border"
          style={{
            width: `calc(100% - ${100 / children.length}%)`,
          }}
        />
      </div>
      <div className="flex items-start justify-center gap-4 pt-0">
        {children.map((child, i) => (
          <div key={i} className="flex flex-col items-center">
            <VLine height={16} />
            {child}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══════ Position Sub-Tree ═══════ */
const PositionBranch = ({
  position, employeeMap,
}: {
  position: Position;
  employeeMap: Map<string, Employee[]>;
}) => {
  const emps = employeeMap.get(position.id) || [];
  const children = position.children || [];

  return (
    <div className="flex flex-col items-center">
      <ChartNode label={position.name} variant="position" employees={emps} icon={Users} />
      {children.length > 0 && (
        <BranchContainer>
          {children.map((child) => (
            <PositionBranch key={child.id} position={child} employeeMap={employeeMap} />
          ))}
        </BranchContainer>
      )}
    </div>
  );
};

/* ═══════ Affiliation Branch ═══════ */
const AffiliationBranch = ({
  aff, employeeMap,
}: {
  aff: Affiliation;
  employeeMap: Map<string, Employee[]>;
}) => {
  return (
    <div className="flex flex-col items-center">
      <ChartNode label={aff.name} sublabel={`${aff.positions.length} ตำแหน่ง`} variant="affiliation" icon={Building2} />
      {aff.positions.length > 0 && (
        <BranchContainer>
          {aff.positions.map((pos) => (
            <PositionBranch key={pos.id} position={pos} employeeMap={employeeMap} />
          ))}
        </BranchContainer>
      )}
    </div>
  );
};

/* ═══════ OrgLevel Branch ═══════ */
const OrgLevelBranch = ({
  node, affiliations, employeeMap, orgLevelEmployeeMap,
}: {
  node: OrgLevel;
  affiliations: Affiliation[];
  employeeMap: Map<string, Employee[]>;
  orgLevelEmployeeMap: Map<string, Employee[]>;
}) => {
  const children = node.children || [];
  const attachedAffs = affiliations.filter((a) => a.parent_org_level_id === node.id);
  const emps = orgLevelEmployeeMap.get(node.id) || [];
  const allBranches: React.ReactNode[] = [];

  children.forEach((child) => {
    allBranches.push(
      <OrgLevelBranch
        key={child.id} node={child}
        affiliations={affiliations} employeeMap={employeeMap}
        orgLevelEmployeeMap={orgLevelEmployeeMap}
      />
    );
  });

  attachedAffs.forEach((aff) => {
    allBranches.push(
      <AffiliationBranch key={aff.id} aff={aff} employeeMap={employeeMap} />
    );
  });

  return (
    <div className="flex flex-col items-center">
      <ChartNode label={node.name} variant="orgLevel" employees={emps} icon={Network} />
      {allBranches.length > 0 && (
        <BranchContainer>{allBranches}</BranchContainer>
      )}
    </div>
  );
};

/* ═══════ Main Chart ═══════ */
const OrgChartView = ({
  programName, orgLevels, affiliations,
  positionEmployeeMap, orgLevelEmployeeMap,
}: OrgChartViewProps) => {
  const rootAffiliations = useMemo(
    () => affiliations.filter((a) => !a.parent_org_level_id),
    [affiliations]
  );

  // Build all root-level branches
  const rootBranches: React.ReactNode[] = [];
  orgLevels.forEach((ol) => {
    rootBranches.push(
      <OrgLevelBranch
        key={ol.id} node={ol}
        affiliations={affiliations}
        employeeMap={positionEmployeeMap}
        orgLevelEmployeeMap={orgLevelEmployeeMap}
      />
    );
  });
  rootAffiliations.forEach((aff) => {
    rootBranches.push(
      <AffiliationBranch key={aff.id} aff={aff} employeeMap={positionEmployeeMap} />
    );
  });

  return (
    <div className="card-base overflow-x-auto p-6">
      <div className="flex flex-col items-center min-w-max pb-8">
        {/* Root Company Node */}
        <ChartNode
          label={programName || "บริษัท"}
          sublabel="บริษัท / องค์กร"
          variant="root"
          icon={Building2}
        />

        {rootBranches.length > 0 ? (
          <BranchContainer>{rootBranches}</BranchContainer>
        ) : (
          <div className="mt-8 text-sm text-muted-foreground">
            ยังไม่มีโครงสร้าง — เพิ่มระดับองค์กรหรือสังกัดก่อน
          </div>
        )}
      </div>
    </div>
  );
};

export default OrgChartView;
