
-- Affiliations table
CREATE TABLE public.affiliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read affiliations"
  ON public.affiliations FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/HR/Manager can manage affiliations"
  ON public.affiliations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'));

-- Positions table (tree via parent_id)
CREATE TABLE public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliation_id uuid NOT NULL REFERENCES public.affiliations(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.positions(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read positions"
  ON public.positions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/HR/Manager can manage positions"
  ON public.positions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr') OR has_role(auth.uid(), 'manager'));

-- Seed demo affiliations
INSERT INTO public.affiliations (id, name, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'รถไฟฟ้าขสมช', 0),
  ('a0000001-0000-0000-0000-000000000002', 'เตาเผาขยะสวนดอก', 1);

-- Seed positions for รถไฟฟ้าขสมช
INSERT INTO public.positions (id, affiliation_id, parent_id, name, sort_order) VALUES
  ('b0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', NULL, 'เจ้าหน้าที่วิจัย', 0),
  ('b0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000001', NULL, 'วิศวกรระบบราง', 1),
  ('b0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000001', NULL, 'พนักงานขับรถไฟฟ้า', 2),
  ('b0000001-0000-0000-0000-000000000021', 'a0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000002', 'ช่างเทคนิคระบบราง', 0),
  ('b0000001-0000-0000-0000-000000000022', 'a0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000002', 'ผู้ช่วยวิศวกร', 1);

-- Seed positions for เตาเผาขยะสวนดอก
INSERT INTO public.positions (id, affiliation_id, parent_id, name, sort_order) VALUES
  ('b0000002-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000002', NULL, 'เจ้าหน้าที่ควบคุมเตาเผา', 0),
  ('b0000002-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000002', NULL, 'ช่างซ่อมบำรุง', 1),
  ('b0000002-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000002', NULL, 'เจ้าหน้าที่สิ่งแวดล้อม', 2);
