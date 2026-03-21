import { createContext, useContext, useState, useMemo, useCallback, type ReactNode, type Dispatch, type SetStateAction } from "react";

/* ═══════════════════ Types ═══════════════════ */
export interface Position {
  id: number;
  name: string;
  children?: Position[];
}

export interface Affiliation {
  id: number;
  name: string;
  positions: Position[];
}

export interface OrgNode {
  id: string;
  name: string;
  position: string;
  dept: string;
  email: string;
  phone: string;
  headCount: number;
  children?: OrgNode[];
}

/* ═══════════════════ Initial Mock Data ═══════════════════ */
const INITIAL_ORG: OrgNode = {
  id: "1",
  name: "บริษัท เอ็กซ์วาย จำกัด",
  position: "บริษัท",
  dept: "สำนักงานใหญ่",
  email: "info@company.com",
  phone: "02-xxx-xxxx",
  headCount: 248,
  children: [
    {
      id: "2", name: "นายประธาน รุ่งเรือง", position: "CEO / กรรมการผู้จัดการ", dept: "ผู้บริหาร",
      email: "ceo@company.com", phone: "081-000-0001", headCount: 248,
      children: [
        {
          id: "3", name: "นางสาวสุภาพ ดีมาก", position: "ผู้อำนวยการฝ่าย HR", dept: "ฝ่าย HR",
          email: "hr@company.com", phone: "081-000-0002", headCount: 12,
          children: [
            { id: "7", name: "นิดา สุขใจ", position: "เจ้าหน้าที่ HR", dept: "ฝ่าย HR", email: "nida@company.com", phone: "086-789-0123", headCount: 0 },
            { id: "8", name: "กาญจนา ใสซื่อ", position: "เจ้าหน้าที่ธุรการ", dept: "ฝ่าย HR", email: "kanchana@company.com", phone: "088-901-2345", headCount: 0 },
          ],
        },
        {
          id: "4", name: "นายสมชาย ใจดี", position: "ผู้จัดการฝ่ายขาย", dept: "ฝ่ายขาย",
          email: "somchai@company.com", phone: "081-234-5678", headCount: 45,
          children: [
            { id: "9", name: "ประสิทธิ์ ทำได้", position: "พนักงานขาย", dept: "ฝ่ายขาย", email: "prasit@company.com", phone: "087-890-1234", headCount: 0 },
          ],
        },
        {
          id: "5", name: "นายมานะ ขยัน", position: "หัวหน้าฝ่าย IT", dept: "ฝ่าย IT",
          email: "mana@company.com", phone: "083-456-7890", headCount: 18,
          children: [
            { id: "10", name: "พัฒนา โค้ดดี", position: "นักพัฒนา Frontend", dept: "ฝ่าย IT", email: "dev@company.com", phone: "089-012-3456", headCount: 0 },
          ],
        },
        {
          id: "6", name: "นางสาวสุดา ดีใจ", position: "ผู้จัดการฝ่ายบัญชี", dept: "ฝ่ายบัญชี",
          email: "suda@company.com", phone: "084-567-8901", headCount: 24,
        },
      ],
    },
  ],
};

/* ═══════════════════ Tree Helpers ═══════════════════ */
export const genId = () => crypto.randomUUID().slice(0, 8);

export const updateNodeHelper = (tree: OrgNode, id: string, updater: (n: OrgNode) => OrgNode): OrgNode => {
  if (tree.id === id) return updater(tree);
  return { ...tree, children: tree.children?.map((c) => updateNodeHelper(c, id, updater)) };
};

export const addChildHelper = (tree: OrgNode, parentId: string, child: OrgNode): OrgNode => {
  if (tree.id === parentId) {
    return { ...tree, children: [...(tree.children || []), child] };
  }
  return { ...tree, children: tree.children?.map((c) => addChildHelper(c, parentId, child)) };
};

export const removeNodeHelper = (tree: OrgNode, id: string): OrgNode => {
  return {
    ...tree,
    children: tree.children
      ?.filter((c) => c.id !== id)
      .map((c) => removeNodeHelper(c, id)),
  };
};

export const findNode = (tree: OrgNode, id: string): OrgNode | null => {
  if (tree.id === id) return tree;
  for (const c of tree.children || []) {
    const found = findNode(c, id);
    if (found) return found;
  }
  return null;
};

export const countNodes = (tree: OrgNode): number => {
  return 1 + (tree.children?.reduce((sum, c) => sum + countNodes(c), 0) || 0);
};

export const countDepts = (tree: OrgNode, set = new Set<string>()): number => {
  set.add(tree.dept);
  tree.children?.forEach((c) => countDepts(c, set));
  return set.size;
};

/* ═══════════════════ Department Extraction ═══════════════════ */
const collectDepartments = (node: OrgNode, set: Set<string>) => {
  // Skip root node (company level)
  if (node.dept && node.dept !== "สำนักงานใหญ่") {
    set.add(node.dept);
  }
  node.children?.forEach((c) => collectDepartments(c, set));
};

const findDeptHead = (node: OrgNode, deptName: string): string | null => {
  // The first node with matching dept that has children or is at level 2 (direct under CEO) is the head
  if (node.dept === deptName && node.children && node.children.length > 0) {
    return node.name;
  }
  // Check if this node's parent dept matches and this is the top-level for that dept
  for (const c of node.children || []) {
    if (c.dept === deptName) {
      // This child is the head of the dept if it has children or is a direct child of CEO level
      return c.name;
    }
    const found = findDeptHead(c, deptName);
    if (found) return found;
  }
  return null;
};

/* ═══════════════════ Initial Affiliations ═══════════════════ */
const INITIAL_AFFILIATIONS: Affiliation[] = [
  {
    id: 1, name: "รถไฟฟ้าขสมช",
    positions: [
      { id: 1, name: "เจ้าหน้าที่วิจัย" },
      { id: 2, name: "วิศวกรระบบราง" },
      { id: 3, name: "พนักงานขับรถไฟฟ้า" },
    ],
  },
  {
    id: 2, name: "เตาเผาขยะสวนดอก",
    positions: [
      { id: 1, name: "เจ้าหน้าที่ควบคุมเตาเผา" },
      { id: 2, name: "ช่างซ่อมบำรุง" },
      { id: 3, name: "เจ้าหน้าที่สิ่งแวดล้อม" },
    ],
  },
];

/* ═══════════════════ Context ═══════════════════ */
interface OrgContextType {
  orgTree: OrgNode;
  setOrgTree: React.Dispatch<React.SetStateAction<OrgNode>>;
  departments: string[];
  getDeptHead: (deptName: string) => string | null;
  updateNode: (id: string, updater: (n: OrgNode) => OrgNode) => void;
  addChild: (parentId: string, child: OrgNode) => void;
  removeNode: (id: string) => void;
  affiliations: Affiliation[];
  setAffiliations: Dispatch<SetStateAction<Affiliation[]>>;
  allPositions: string[];
  affiliationNames: string[];
}

const OrgContext = createContext<OrgContextType | null>(null);

export const OrgProvider = ({ children }: { children: ReactNode }) => {
  const [orgTree, setOrgTree] = useState<OrgNode>(INITIAL_ORG);
  const [affiliations, setAffiliations] = useState<Affiliation[]>(INITIAL_AFFILIATIONS);

  const departments = useMemo(() => {
    const set = new Set<string>();
    collectDepartments(orgTree, set);
    return Array.from(set).sort();
  }, [orgTree]);

  const affiliationNames = useMemo(() => affiliations.map((a) => a.name), [affiliations]);
  const allPositions = useMemo(() => {
    const set = new Set<string>();
    affiliations.forEach((a) => a.positions.forEach((p) => set.add(p.name)));
    return Array.from(set).sort();
  }, [affiliations]);

  const getDeptHead = useCallback((deptName: string) => {
    return findDeptHead(orgTree, deptName);
  }, [orgTree]);

  const updateNode = useCallback((id: string, updater: (n: OrgNode) => OrgNode) => {
    setOrgTree((tree) => updateNodeHelper(tree, id, updater));
  }, []);

  const addChild = useCallback((parentId: string, child: OrgNode) => {
    setOrgTree((tree) => addChildHelper(tree, parentId, child));
  }, []);

  const removeNode = useCallback((id: string) => {
    setOrgTree((tree) => removeNodeHelper(tree, id));
  }, []);

  return (
    <OrgContext.Provider value={{ orgTree, setOrgTree, departments, getDeptHead, updateNode, addChild, removeNode, affiliations, setAffiliations, allPositions, affiliationNames }}>
      {children}
    </OrgContext.Provider>
  );
};

export const useOrg = () => {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
};
