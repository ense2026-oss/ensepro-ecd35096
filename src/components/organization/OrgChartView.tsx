import { useMemo } from "react";
import { Building2, Network, Users, Plus, Edit, Trash2, UserPlus } from "lucide-react";
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
  canManage?: boolean;
  canAdd?: boolean;
  // CRUD callbacks
  onRenameCompany?: () => void;
  onAddOrgLevel?: (parentId: string | null) => void;
  onEditOrgLevel?: (o: OrgLevel) => void;
  onDeleteOrgLevel?: (o: OrgLevel) => void;
  onAssignOrgLevel?: (o: OrgLevel) => void;
  onAddPosition?: (affId: string, parentPos: Position | null) => void;
  onEditPosition?: (p: Position) => void;
  onDeletePosition?: (p: Position) => void;
  onAssignPosition?: (p: Position) => void;
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

/* ═══════ Action Buttons ═══════ */
const NodeActions = ({ actions }: { actions: { icon: React.ElementType; title: string; onClick: () => void; color: string }[] }) => (
  <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
    {actions.map((a, i) => (
      <button key={i} onClick={(e) => { e.stopPropagation(); a.onClick(); }}
        className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${a.color}`} title={a.title}>
        <a.icon className="w-3 h-3" />
      </button>
    ))}
  </div>
);

/* ═══════ Chart Node ═══════ */
const ChartNode = ({
  label, sublabel, variant = "default", employees: emps = [], icon: Icon, actions,
}: {
  label: string;
  sublabel?: string;
  variant?: "root" | "orgLevel" | "affiliation" | "position" | "default";
  employees?: Employee[];
  icon?: React.ElementType;
  actions?: { icon: React.ElementType; title: string; onClick: () => void; color: string }[];
}) => {
  const styles = {
    root: "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 min-w-[200px]",
    orgLevel: "bg-card border-primary/30 shadow-md min-w-[160px]",
    affiliation: "bg-card border-accent/50 shadow-md min-w-[150px]",
    position: "bg-card border-border shadow-sm min-w-[140px]",
    default: "bg-card border-border shadow-sm min-w-[140px]",
  };

  return (
    <div className={`group relative inline-flex flex-col items-center px-4 py-3 rounded-2xl border-2 transition-all hover:scale-[1.02] ${styles[variant]}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className={`w-4 h-4 flex-shrink-0 ${variant === "root" ? "text-primary-foreground" : "text-primary"}`} />}
        <span className={`text-sm font-bold truncate max-w-[160px] ${variant === "root" ? "text-primary-foreground" : "text-foreground"}`}>{label}</span>
      </div>
      {sublabel && (
        <span className={`text-[10px] mt-0.5 ${variant === "root" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{sublabel}</span>
      )}
      <EmployeeCluster emps={emps} />
      {actions && actions.length > 0 && <NodeActions actions={actions} />}
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
      <div className="relative w-full">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 bg-border"
          style={{ width: `calc(100% - ${100 / children.length}%)` }}
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
  position, employeeMap, canManage,
  onEdit, onDelete, onAssign, onAddSub,
}: {
  position: Position;
  employeeMap: Map<string, Employee[]>;
  canManage?: boolean;
  onEdit?: (p: Position) => void;
  onDelete?: (p: Position) => void;
  onAssign?: (p: Position) => void;
  onAddSub?: (p: Position) => void;
}) => {
  const emps = employeeMap.get(position.id) || [];
  const children = position.children || [];
  const actions = canManage ? [
    { icon: UserPlus, title: "กำหนดบุคคล", onClick: () => onAssign?.(position), color: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20" },
    { icon: Plus, title: "เพิ่มตำแหน่งย่อย", onClick: () => onAddSub?.(position), color: "bg-primary/10 text-primary hover:bg-primary/20" },
    { icon: Edit, title: "แก้ไข", onClick: () => onEdit?.(position), color: "bg-accent text-accent-foreground hover:bg-accent/80" },
    { icon: Trash2, title: "ลบ", onClick: () => onDelete?.(position), color: "bg-destructive/10 text-destructive hover:bg-destructive/20" },
  ] : undefined;

  return (
    <div className="flex flex-col items-center">
      <ChartNode label={position.name} variant="position" employees={emps} icon={Users} actions={actions} />
      {children.length > 0 && (
        <BranchContainer>
          {children.map((child) => (
            <PositionBranch key={child.id} position={child} employeeMap={employeeMap}
              canManage={canManage} onEdit={onEdit} onDelete={onDelete} onAssign={onAssign} onAddSub={onAddSub} />
          ))}
        </BranchContainer>
      )}
    </div>
  );
};

/* ═══════ Affiliation Branch ═══════ */
const AffiliationBranch = ({
  aff, employeeMap, canManage,
  onAddPosition, onEditPosition, onDeletePosition, onAssignPosition,
}: {
  aff: Affiliation;
  employeeMap: Map<string, Employee[]>;
  canManage?: boolean;
  onAddPosition?: (affId: string, parentPos: Position | null) => void;
  onEditPosition?: (p: Position) => void;
  onDeletePosition?: (p: Position) => void;
  onAssignPosition?: (p: Position) => void;
}) => {
  const actions = canManage ? [
    { icon: Plus, title: "เพิ่มตำแหน่ง", onClick: () => onAddPosition?.(aff.id, null), color: "bg-primary/10 text-primary hover:bg-primary/20" },
  ] : undefined;

  return (
    <div className="flex flex-col items-center">
      <ChartNode label={aff.name} sublabel={`${aff.positions.length} ตำแหน่ง`} variant="affiliation" icon={Building2} actions={actions} />
      {aff.positions.length > 0 && (
        <BranchContainer>
          {aff.positions.map((pos) => (
            <PositionBranch key={pos.id} position={pos} employeeMap={employeeMap}
              canManage={canManage} onEdit={onEditPosition} onDelete={onDeletePosition} onAssign={onAssignPosition}
              onAddSub={(p) => onAddPosition?.(aff.id, p)} />
          ))}
        </BranchContainer>
      )}
    </div>
  );
};

/* ═══════ OrgLevel Branch ═══════ */
const OrgLevelBranch = ({
  node, affiliations, employeeMap, orgLevelEmployeeMap, canManage,
  onEditOrgLevel, onDeleteOrgLevel, onAddOrgLevelChild, onAssignOrgLevel,
  onAddPosition, onEditPosition, onDeletePosition, onAssignPosition,
}: {
  node: OrgLevel;
  affiliations: Affiliation[];
  employeeMap: Map<string, Employee[]>;
  orgLevelEmployeeMap: Map<string, Employee[]>;
  canManage?: boolean;
  onEditOrgLevel?: (o: OrgLevel) => void;
  onDeleteOrgLevel?: (o: OrgLevel) => void;
  onAddOrgLevelChild?: (parentId: string) => void;
  onAssignOrgLevel?: (o: OrgLevel) => void;
  onAddPosition?: (affId: string, parentPos: Position | null) => void;
  onEditPosition?: (p: Position) => void;
  onDeletePosition?: (p: Position) => void;
  onAssignPosition?: (p: Position) => void;
}) => {
  const children = node.children || [];
  const attachedAffs = affiliations.filter((a) => a.parent_org_level_id === node.id);
  const emps = orgLevelEmployeeMap.get(node.id) || [];
  const allBranches: React.ReactNode[] = [];

  const actions = canManage ? [
    { icon: UserPlus, title: "กำหนดบุคคล", onClick: () => onAssignOrgLevel?.(node), color: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20" },
    { icon: Plus, title: "เพิ่มระดับย่อย", onClick: () => onAddOrgLevelChild?.(node.id), color: "bg-primary/10 text-primary hover:bg-primary/20" },
    { icon: Edit, title: "แก้ไข", onClick: () => onEditOrgLevel?.(node), color: "bg-accent text-accent-foreground hover:bg-accent/80" },
    { icon: Trash2, title: "ลบ", onClick: () => onDeleteOrgLevel?.(node), color: "bg-destructive/10 text-destructive hover:bg-destructive/20" },
  ] : undefined;

  children.forEach((child) => {
    allBranches.push(
      <OrgLevelBranch
        key={child.id} node={child}
        affiliations={affiliations} employeeMap={employeeMap}
        orgLevelEmployeeMap={orgLevelEmployeeMap} canManage={canManage}
        onEditOrgLevel={onEditOrgLevel} onDeleteOrgLevel={onDeleteOrgLevel}
        onAddOrgLevelChild={onAddOrgLevelChild} onAssignOrgLevel={onAssignOrgLevel}
        onAddPosition={onAddPosition} onEditPosition={onEditPosition}
        onDeletePosition={onDeletePosition} onAssignPosition={onAssignPosition}
      />
    );
  });

  attachedAffs.forEach((aff) => {
    allBranches.push(
      <AffiliationBranch key={aff.id} aff={aff} employeeMap={employeeMap}
        canManage={canManage} onAddPosition={onAddPosition} onEditPosition={onEditPosition}
        onDeletePosition={onDeletePosition} onAssignPosition={onAssignPosition} />
    );
  });

  return (
    <div className="flex flex-col items-center">
      <ChartNode label={node.name} variant="orgLevel" employees={emps} icon={Network} actions={actions} />
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
  canManage, onRenameCompany, onAddOrgLevel,
  onEditOrgLevel, onDeleteOrgLevel, onAssignOrgLevel,
  onAddPosition, onEditPosition, onDeletePosition, onAssignPosition,
}: OrgChartViewProps) => {
  const rootAffiliations = useMemo(
    () => affiliations.filter((a) => !a.parent_org_level_id),
    [affiliations]
  );

  const rootActions = canManage ? [
    { icon: Edit, title: "แก้ไขชื่อ", onClick: () => onRenameCompany?.(), color: "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30" },
    { icon: Plus, title: "เพิ่มระดับองค์กร", onClick: () => onAddOrgLevel?.(null), color: "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30" },
  ] : undefined;

  const rootBranches: React.ReactNode[] = [];
  orgLevels.forEach((ol) => {
    rootBranches.push(
      <OrgLevelBranch
        key={ol.id} node={ol}
        affiliations={affiliations} employeeMap={positionEmployeeMap}
        orgLevelEmployeeMap={orgLevelEmployeeMap} canManage={canManage}
        onEditOrgLevel={onEditOrgLevel} onDeleteOrgLevel={onDeleteOrgLevel}
        onAddOrgLevelChild={(parentId) => onAddOrgLevel?.(parentId)} onAssignOrgLevel={onAssignOrgLevel}
        onAddPosition={onAddPosition} onEditPosition={onEditPosition}
        onDeletePosition={onDeletePosition} onAssignPosition={onAssignPosition}
      />
    );
  });
  rootAffiliations.forEach((aff) => {
    rootBranches.push(
      <AffiliationBranch key={aff.id} aff={aff} employeeMap={positionEmployeeMap}
        canManage={canManage} onAddPosition={onAddPosition} onEditPosition={onEditPosition}
        onDeletePosition={onDeletePosition} onAssignPosition={onAssignPosition} />
    );
  });

  return (
    <div className="card-base overflow-x-auto p-6">
      <div className="flex flex-col items-center min-w-max pb-8">
        <ChartNode
          label={programName || "บริษัท"}
          sublabel="บริษัท / องค์กร"
          variant="root"
          icon={Building2}
          actions={rootActions}
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
