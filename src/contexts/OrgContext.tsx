import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

/* ═══════════════════ Types ═══════════════════ */
export interface Position {
  id: string;
  name: string;
  affiliation_id: string;
  parent_id: string | null;
  sort_order: number;
  children?: Position[];
}

export interface Affiliation {
  id: string;
  name: string;
  sort_order: number;
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

/* ═══════════════════ Tree Helpers (OrgNode — kept local) ═══════════════════ */
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

export const genId = () => crypto.randomUUID().slice(0, 8);

export const updateNodeHelper = (tree: OrgNode, id: string, updater: (n: OrgNode) => OrgNode): OrgNode => {
  if (tree.id === id) return updater(tree);
  return { ...tree, children: tree.children?.map((c) => updateNodeHelper(c, id, updater)) };
};

export const addChildHelper = (tree: OrgNode, parentId: string, child: OrgNode): OrgNode => {
  if (tree.id === parentId) return { ...tree, children: [...(tree.children || []), child] };
  return { ...tree, children: tree.children?.map((c) => addChildHelper(c, parentId, child)) };
};

export const removeNodeHelper = (tree: OrgNode, id: string): OrgNode => ({
  ...tree,
  children: tree.children?.filter((c) => c.id !== id).map((c) => removeNodeHelper(c, id)),
});

export const findNode = (tree: OrgNode, id: string): OrgNode | null => {
  if (tree.id === id) return tree;
  for (const c of tree.children || []) {
    const found = findNode(c, id);
    if (found) return found;
  }
  return null;
};

export const countNodes = (tree: OrgNode): number =>
  1 + (tree.children?.reduce((sum, c) => sum + countNodes(c), 0) || 0);

export const countDepts = (tree: OrgNode, set = new Set<string>()): number => {
  set.add(tree.dept);
  tree.children?.forEach((c) => countDepts(c, set));
  return set.size;
};

const collectDepartments = (node: OrgNode, set: Set<string>) => {
  if (node.dept && node.dept !== "สำนักงานใหญ่") set.add(node.dept);
  node.children?.forEach((c) => collectDepartments(c, set));
};

const findDeptHead = (node: OrgNode, deptName: string): string | null => {
  if (node.dept === deptName && node.children && node.children.length > 0) return node.name;
  for (const c of node.children || []) {
    if (c.dept === deptName) return c.name;
    const found = findDeptHead(c, deptName);
    if (found) return found;
  }
  return null;
};

/* ═══════════════════ Build Position Tree from flat rows ═══════════════════ */
interface DbPosition {
  id: string;
  affiliation_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
}

const buildPositionTree = (flat: DbPosition[]): Position[] => {
  const map = new Map<string, Position>();
  flat.forEach((p) => map.set(p.id, { ...p, children: [] }));

  const roots: Position[] = [];
  flat.forEach((p) => {
    const node = map.get(p.id)!;
    if (p.parent_id && map.has(p.parent_id)) {
      map.get(p.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort by sort_order at each level
  const sortTree = (nodes: Position[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    nodes.forEach((n) => { if (n.children?.length) sortTree(n.children); });
  };
  sortTree(roots);
  return roots;
};

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
  allPositions: string[];
  affiliationNames: string[];
  loading: boolean;
  refetchAffiliations: () => Promise<void>;
  // CRUD for affiliations
  addAffiliation: (name: string) => Promise<Affiliation | null>;
  updateAffiliation: (id: string, name: string) => Promise<void>;
  deleteAffiliation: (id: string) => Promise<void>;
  // CRUD for positions
  addPosition: (affiliationId: string, parentId: string | null, name: string) => Promise<Position | null>;
  updatePosition: (id: string, name: string) => Promise<void>;
  deletePosition: (id: string) => Promise<void>;
  reorderPositions: (ids: string[]) => Promise<void>;
}

const OrgContext = createContext<OrgContextType | null>(null);

export const OrgProvider = ({ children }: { children: ReactNode }) => {
  const [orgTree, setOrgTree] = useState<OrgNode>(INITIAL_ORG);
  const [affiliations, setAffiliations] = useState<Affiliation[]>([]);
  const [loading, setLoading] = useState(true);

  /* ─── Fetch ─── */
  const fetchAffiliations = useCallback(async () => {
    const [affRes, posRes] = await Promise.all([
      supabase.from("affiliations").select("*").order("sort_order"),
      supabase.from("positions").select("*").order("sort_order"),
    ]);

    const affs = (affRes.data || []) as { id: string; name: string; sort_order: number }[];
    const allPos = (posRes.data || []) as DbPosition[];

    const result: Affiliation[] = affs.map((a) => ({
      id: a.id,
      name: a.name,
      sort_order: a.sort_order,
      positions: buildPositionTree(allPos.filter((p) => p.affiliation_id === a.id)),
    }));

    setAffiliations(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAffiliations();
  }, [fetchAffiliations]);

  /* ─── Affiliation CRUD ─── */
  const addAffiliation = useCallback(async (name: string): Promise<Affiliation | null> => {
    const maxOrder = affiliations.length;
    const { data, error } = await supabase
      .from("affiliations")
      .insert({ name, sort_order: maxOrder })
      .select()
      .single();
    if (error || !data) return null;
    await fetchAffiliations();
    return { id: data.id, name: data.name, sort_order: data.sort_order, positions: [] };
  }, [affiliations.length, fetchAffiliations]);

  const updateAffiliation = useCallback(async (id: string, name: string) => {
    await supabase.from("affiliations").update({ name }).eq("id", id);
    await fetchAffiliations();
  }, [fetchAffiliations]);

  const deleteAffiliation = useCallback(async (id: string) => {
    await supabase.from("affiliations").delete().eq("id", id);
    await fetchAffiliations();
  }, [fetchAffiliations]);

  /* ─── Position CRUD ─── */
  const addPosition = useCallback(async (affiliationId: string, parentId: string | null, name: string): Promise<Position | null> => {
    // Get max sort_order for siblings
    let query = supabase.from("positions").select("sort_order").eq("affiliation_id", affiliationId);
    if (parentId) {
      query = query.eq("parent_id", parentId);
    } else {
      query = query.is("parent_id", null);
    }
    const { data: siblings } = await query;
    const maxOrder = siblings?.length ? Math.max(...siblings.map((s: any) => s.sort_order)) + 1 : 0;

    const { data, error } = await supabase
      .from("positions")
      .insert({ affiliation_id: affiliationId, parent_id: parentId, name, sort_order: maxOrder })
      .select()
      .single();
    if (error || !data) return null;
    await fetchAffiliations();
    return { id: data.id, name: data.name, affiliation_id: data.affiliation_id, parent_id: data.parent_id, sort_order: data.sort_order };
  }, [fetchAffiliations]);

  const updatePosition = useCallback(async (id: string, name: string) => {
    await supabase.from("positions").update({ name }).eq("id", id);
    await fetchAffiliations();
  }, [fetchAffiliations]);

  const deletePosition = useCallback(async (id: string) => {
    await supabase.from("positions").delete().eq("id", id);
    await fetchAffiliations();
  }, [fetchAffiliations]);

  const reorderPositions = useCallback(async (ids: string[]) => {
    // Update sort_order for each position
    await Promise.all(ids.map((id, idx) =>
      supabase.from("positions").update({ sort_order: idx }).eq("id", id)
    ));
    await fetchAffiliations();
  }, [fetchAffiliations]);

  /* ─── Derived ─── */
  const departments = useMemo(() => {
    const set = new Set<string>();
    collectDepartments(orgTree, set);
    return Array.from(set).sort();
  }, [orgTree]);

  const affiliationNames = useMemo(() => affiliations.map((a) => a.name), [affiliations]);

  const allPositions = useMemo(() => {
    const set = new Set<string>();
    const collect = (positions: Position[]) => {
      positions.forEach((p) => {
        set.add(p.name);
        if (p.children) collect(p.children);
      });
    };
    affiliations.forEach((a) => collect(a.positions));
    return Array.from(set).sort();
  }, [affiliations]);

  const getDeptHead = useCallback((deptName: string) => findDeptHead(orgTree, deptName), [orgTree]);

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
    <OrgContext.Provider value={{
      orgTree, setOrgTree, departments, getDeptHead, updateNode, addChild, removeNode,
      affiliations, allPositions, affiliationNames, loading,
      refetchAffiliations: fetchAffiliations,
      addAffiliation, updateAffiliation, deleteAffiliation,
      addPosition, updatePosition, deletePosition, reorderPositions,
    }}>
      {children}
    </OrgContext.Provider>
  );
};

export const useOrg = () => {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
};
