

## Plan: Edit Company Name in Org Page + Add Org-Level Positions at Root

### What changes

1. **Editable company name on Organization page** — clicking the company root node opens an inline edit or dialog to rename `programName`, saving to `company_settings` via `BrandingContext`.

2. **Add org-level positions directly under company root** — add a "+" button next to the company root node that calls `openAddOrgLevel(null)` to create root-level org positions (e.g. ผู้อำนวยการ, หัวหน้า) that are not tied to any affiliation.

### Files to modify

| File | Change |
|------|--------|
| `src/pages/Organization.tsx` | (1) Add edit icon + click handler on company root node to open a rename dialog. (2) Add "+" button next to company root for adding root org levels. (3) Add a small rename dialog for company name that calls `updateProgramName`. |
| `src/contexts/BrandingContext.tsx` | Add `updateProgramName(name: string)` function that saves to `company_settings` in DB and updates context state + localStorage cache. Expose it in context. |

### Detail

**Company root node (lines 540-548)** — currently static display. Will add:
- An Edit button that opens a dialog to change the company/org name
- The save action calls a new `updateProgramName()` from BrandingContext which updates `company_settings` row with key `program_name`
- A "+" button (same as the existing top-right button) to add root org levels directly from the tree

**BrandingContext** — add `updateProgramName` that does:
```typescript
await supabase.from("company_settings").upsert({ key: "program_name", value: newName });
```
Then updates local state + cache.

### Impact
- Users can rename the organization directly from the org chart page
- Users can add company-wide positions (ผู้อำนวยการ, หัวหน้า) directly from the tree root, not just from the top-right button

