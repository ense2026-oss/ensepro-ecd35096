import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from "react";
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
  parent_org_level_id: string | null;
  positions: Position[];
}

export interface OrgLevel {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  children?: OrgLevel[];
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

/* ═══════════════════ Tree Helpers ═══════════════════ */
export const genId = () => crypto.randomUUID().slice(0, 8);

/* ─── Build Position Tree from flat rows ─── */
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

  const sortTree = (nodes: Position[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    nodes.forEach((n) => { if (n.children?.length) sortTree(n.children); });
  };
  sortTree(roots);
  return roots;
};

/* ─── Build OrgLevel Tree from flat rows ─── */
interface DbOrgLevel {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
}

const buildOrgLevelTree = (flat: DbOrgLevel[]): OrgLevel[] => {
  const map = new Map<string, OrgLevel>();
  flat.forEach((o) => map.set(o.id, { ...o, children: [] }));

  const roots: OrgLevel[] = [];
  flat.forEach((o) => {
    const node = map.get(o.id)!;
    if (o.parent_id && map.has(o.parent_id)) {
      map.get(o.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortTree = (nodes: OrgLevel[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    nodes.forEach((n) => { if (n.children?.length) sortTree(n.children); });
  };
  sortTree(roots);
  return roots;
};

/* ═══════════════════ Context ═══════════════════ */
interface OrgContextType {
  affiliations: Affiliation[];
  allPositions: string[];
  affiliationNames: string[];
  loading: boolean;
  refetchAffiliations: () => Promise<void>;
  // Affiliation CRUD
  addAffiliation: (name: string, parentOrgLevelId?: string | null) => Promise<Affiliation | null>;
  updateAffiliation: (id: string, name: string, parentOrgLevelId?: string | null) => Promise<void>;
  deleteAffiliation: (id: string) => Promise<void>;
  // Position CRUD
  addPosition: (affiliationId: string, parentId: string | null, name: string) => Promise<Position | null>;
  updatePosition: (id: string, name: string) => Promise<void>;
  deletePosition: (id: string) => Promise<void>;
  reorderPositions: (ids: string[]) => Promise<void>;
  // OrgLevel
  orgLevels: OrgLevel[];
  orgLevelsFlat: DbOrgLevel[];
  addOrgLevel: (name: string, parentId: string | null) => Promise<OrgLevel | null>;
  updateOrgLevel: (id: string, name: string) => Promise<void>;
  deleteOrgLevel: (id: string) => Promise<void>;
  refetchOrgLevels: () => Promise<void>;
}

const OrgContext = createContext<OrgContextType | null>(null);

export const OrgProvider = ({ children }: { children: ReactNode }) => {
  const [affiliations, setAffiliations] = useState<Affiliation[]>([]);
  const [orgLevels, setOrgLevels] = useState<OrgLevel[]>([]);
  const [orgLevelsFlat, setOrgLevelsFlat] = useState<DbOrgLevel[]>([]);
  const [loading, setLoading] = useState(true);

  /* ─── Fetch ─── */
  const fetchAffiliations = useCallback(async () => {
    const [affRes, posRes] = await Promise.all([
      supabase.from("affiliations").select("*").order("sort_order"),
      supabase.from("positions").select("*").order("sort_order"),
    ]);

    const affs = (affRes.data || []) as { id: string; name: string; sort_order: number; parent_org_level_id: string | null }[];
    const allPos = (posRes.data || []) as DbPosition[];

    const result: Affiliation[] = affs.map((a) => ({
      id: a.id,
      name: a.name,
      sort_order: a.sort_order,
      parent_org_level_id: a.parent_org_level_id,
      positions: buildPositionTree(allPos.filter((p) => p.affiliation_id === a.id)),
    }));

    setAffiliations(result);
  }, []);

  const fetchOrgLevels = useCallback(async () => {
    const { data } = await supabase.from("org_levels").select("*").order("sort_order");
    const flat = (data || []) as DbOrgLevel[];
    setOrgLevelsFlat(flat);
    setOrgLevels(buildOrgLevelTree(flat));
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      await Promise.all([fetchAffiliations(), fetchOrgLevels()]);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchAffiliations, fetchOrgLevels]);

  // Realtime: keep org structure in sync across devices
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    const debounced = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchAffiliations();
        fetchOrgLevels();
      }, 250);
    };
    const channel = supabase
      .channel("org-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "affiliations" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "positions" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "org_levels" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "org_level_employees" }, debounced)
      .subscribe();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchAffiliations, fetchOrgLevels]);

  /* ─── Affiliation CRUD ─── */
  const addAffiliation = useCallback(async (name: string, parentOrgLevelId?: string | null): Promise<Affiliation | null> => {
    const maxOrder = affiliations.length;
    const { data, error } = await supabase
      .from("affiliations")
      .insert({ name, sort_order: maxOrder, parent_org_level_id: parentOrgLevelId || null })
      .select()
      .single();
    if (error) throw error;
    if (!data) return null;
    await fetchAffiliations();
    return { id: data.id, name: data.name, sort_order: data.sort_order, parent_org_level_id: data.parent_org_level_id, positions: [] };
  }, [affiliations.length, fetchAffiliations]);

  const updateAffiliation = useCallback(async (id: string, name: string, parentOrgLevelId?: string | null) => {
    // Capture the previous name so we can cascade the rename to employees' dept text
    const prev = affiliations.find((a) => a.id === id);
    const oldName = prev?.name;

    const update: any = { name };
    if (parentOrgLevelId !== undefined) update.parent_org_level_id = parentOrgLevelId;
    const { error } = await supabase.from("affiliations").update(update).eq("id", id);
    if (error) throw error;

    // Propagate rename to existing employees so system filters stay in sync with settings
    if (oldName && oldName !== name) {
      const { error: empErr } = await supabase
        .from("employees")
        .update({ dept: name })
        .eq("dept", oldName);
      if (empErr) console.error("Failed to cascade affiliation rename to employees:", empErr);
    }

    await fetchAffiliations();
  }, [affiliations, fetchAffiliations]);

  const deleteAffiliation = useCallback(async (id: string) => {
    const { error } = await supabase.from("affiliations").delete().eq("id", id);
    if (error) throw error;
    await fetchAffiliations();
  }, [fetchAffiliations]);

  /* ─── Position CRUD ─── */
  const addPosition = useCallback(async (affiliationId: string, parentId: string | null, name: string): Promise<Position | null> => {
    let query = supabase.from("positions").select("sort_order").eq("affiliation_id", affiliationId);
    if (parentId) { query = query.eq("parent_id", parentId); } else { query = query.is("parent_id", null); }
    const { data: siblings } = await query;
    const maxOrder = siblings?.length ? Math.max(...siblings.map((s: any) => s.sort_order)) + 1 : 0;

    const { data, error } = await supabase
      .from("positions")
      .insert({ affiliation_id: affiliationId, parent_id: parentId, name, sort_order: maxOrder })
      .select()
      .single();
    if (error) throw error;
    if (!data) return null;
    await fetchAffiliations();
    return { id: data.id, name: data.name, affiliation_id: data.affiliation_id, parent_id: data.parent_id, sort_order: data.sort_order };
  }, [fetchAffiliations]);

  const updatePosition = useCallback(async (id: string, name: string) => {
    const { error } = await supabase.from("positions").update({ name }).eq("id", id);
    if (error) throw error;
    await fetchAffiliations();
  }, [fetchAffiliations]);

  const deletePosition = useCallback(async (id: string) => {
    const { error } = await supabase.from("positions").delete().eq("id", id);
    if (error) throw error;
    await fetchAffiliations();
  }, [fetchAffiliations]);

  const reorderPositions = useCallback(async (ids: string[]) => {
    await Promise.all(ids.map((id, idx) =>
      supabase.from("positions").update({ sort_order: idx }).eq("id", id)
    ));
    await fetchAffiliations();
  }, [fetchAffiliations]);

  /* ─── OrgLevel CRUD ─── */
  const addOrgLevel = useCallback(async (name: string, parentId: string | null): Promise<OrgLevel | null> => {
    let query = supabase.from("org_levels").select("sort_order");
    if (parentId) { query = query.eq("parent_id", parentId); } else { query = query.is("parent_id", null); }
    const { data: siblings } = await query;
    const maxOrder = siblings?.length ? Math.max(...siblings.map((s: any) => s.sort_order)) + 1 : 0;

    const { data, error } = await supabase
      .from("org_levels")
      .insert({ name, parent_id: parentId, sort_order: maxOrder })
      .select()
      .single();
    if (error || !data) return null;
    await fetchOrgLevels();
    return { id: data.id, name: data.name, parent_id: data.parent_id, sort_order: data.sort_order };
  }, [fetchOrgLevels]);

  const updateOrgLevel = useCallback(async (id: string, name: string) => {
    await supabase.from("org_levels").update({ name }).eq("id", id);
    await fetchOrgLevels();
  }, [fetchOrgLevels]);

  const deleteOrgLevel = useCallback(async (id: string) => {
    await supabase.from("org_levels").delete().eq("id", id);
    await fetchOrgLevels();
  }, [fetchOrgLevels]);

  /* ─── Derived ─── */
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

  return (
    <OrgContext.Provider value={{
      affiliations, allPositions, affiliationNames, loading,
      refetchAffiliations: fetchAffiliations,
      addAffiliation, updateAffiliation, deleteAffiliation,
      addPosition, updatePosition, deletePosition, reorderPositions,
      orgLevels, orgLevelsFlat,
      addOrgLevel, updateOrgLevel, deleteOrgLevel,
      refetchOrgLevels: fetchOrgLevels,
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
