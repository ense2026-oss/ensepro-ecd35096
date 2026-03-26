

## Plan: Restructure Organization to Unified Tree

### What the user wants

Currently, each affiliation (สังกัด) has its own separate position tree. The user wants a **single unified org tree** where:

```text
บริษัทพลังงานนครพิงค์ จำกัด  (company name from settings)
  └─ ผู้อำนวยการ              (company-level position)
      └─ หัวหน้า              (company-level position)
          ├─ รถไฟฟ้า ขสมช      (affiliation → its positions)
          └─ เตาเผาขยะสวนดอก   (affiliation → its positions)
```

### Approach

**1. New database table: `org_levels`** — stores company-level positions that sit above affiliations in the hierarchy.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| name | text | e.g. ผู้อำนวยการ, หัวหน้า |
| parent_id | uuid nullable | self-referencing for hierarchy |
| sort_order | int | ordering |

RLS: Same pattern as affiliations (Admin/HR/Manager manage, authenticated read).

**2. Update `affiliations` table** — add `parent_org_level_id` column (uuid, nullable, references org_levels) to specify which company-level node each affiliation branches from. If null, affiliations appear directly under the company root.

**3. Update `OrgContext.tsx`**
- Add CRUD for `org_levels` (fetch, add, update, delete, reorder)
- Fetch `affiliations` with their `parent_org_level_id`
- Expose the full org hierarchy data

**4. Rewrite `Organization.tsx` UI**
- Render a single unified tree starting from the company name (pulled from `company_settings`)
- Below the company root, render `org_levels` as tree nodes (recursive, supporting hierarchy)
- At the appropriate org_level node (or at root if no org_levels), render affiliations as branch nodes
- Under each affiliation, render its positions tree (same as current)
- Support add/edit/delete for org_level nodes
- Support assigning employees to org_level nodes (add `position_id` compatibility or a new `org_level_id` on employees)

**5. Update `AffiliationSettings.tsx`**
- Add a dropdown to select which `org_level` each affiliation belongs under

### Files to modify

| File | Change |
|------|--------|
| Migration SQL | Create `org_levels` table, add `parent_org_level_id` to `affiliations` |
| `src/contexts/OrgContext.tsx` | Add org_levels CRUD, fetch org_levels, expose hierarchy |
| `src/pages/Organization.tsx` | Rewrite to render unified tree: company → org_levels → affiliations → positions |
| `src/components/settings/AffiliationSettings.tsx` | Add parent org_level selector when adding/editing affiliations |

### Impact
- Organization page shows one cohesive tree instead of separate sections per affiliation
- Existing position data and employee assignments remain intact
- Company-level roles (ผู้อำนวยการ, หัวหน้า) can have employees assigned to them
- No breaking changes to other pages that reference affiliations/positions

