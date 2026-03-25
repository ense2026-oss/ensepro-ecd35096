

## Plan: Fix Console Warnings

### Problems Identified
1. **Missing `DialogDescription`** — ~15+ Dialog components across the project use `DialogContent` without `DialogDescription`, triggering Radix UI warnings. Per existing accessibility standards (memory), these should use `VisuallyHidden` when no visible description is needed.
2. **MobileFooterNav ref warning** — React warns that function components cannot receive refs. This is likely from React Router or the parent layout attempting to pass a ref.

*Note: WebSocket failures, 404s, and refresh token errors in the screenshot are dev-server/session artifacts — not code bugs.*

### Approach

**1. Add hidden `DialogDescription` to all Dialogs missing it**

Import `DialogDescription` and add a `VisuallyHidden`-wrapped description to every `DialogContent` that lacks one. Files to update:

- `src/pages/Attendance.tsx` (3 dialogs)
- `src/pages/CheckIn.tsx` (1 dialog)
- `src/pages/Payroll.tsx` (2 dialogs)
- `src/pages/Organization.tsx` (2 dialogs)
- `src/pages/ShiftManagement.tsx` (1 dialog)
- `src/components/leave/LeaveRequestDialog.tsx`
- `src/components/contracts/ContractFormDialog.tsx`
- `src/components/contracts/ContractDetailDialog.tsx`
- `src/components/contracts/SignatureDialog.tsx`
- `src/components/settings/ShiftsSettings.tsx`
- `src/components/settings/RolesSettings.tsx`
- `src/components/settings/LeaveTypesSettings.tsx`
- `src/components/settings/LocationsSettings.tsx`

Pattern: Add `<DialogDescription className="sr-only">...</DialogDescription>` after each `DialogTitle`.

**2. Fix MobileFooterNav ref warning**

Wrap `MobileFooterNav` with `React.forwardRef` so React doesn't warn when the parent layout renders it.

### Impact
- Eliminates all `Missing Description` console warnings
- Eliminates the `forwardRef` warning
- No visual changes to the UI

