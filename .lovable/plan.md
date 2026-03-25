

## Status: Already Done

All four pages already use `usePermissions()` with dynamic permission checks:

- **Dashboard.tsx** — uses `getScope(role, 'employee')` to determine view type
- **Contracts.tsx** — uses `canAction(role, 'contracts', 'add/edit')` and `getScope(role, 'contracts')`
- **OvertimeRequest.tsx** — uses `canAction(role, 'ot', 'add/approve')` (local `hasAdminAccess` variable, not from AuthContext)
- **Notifications.tsx** — uses `canAction(role, 'leave/ot', 'approve')` for `hasApprovalAccess`

No component outside `AuthContext.tsx` imports `isAdmin`, `isManager`, `isHR`, `isEmployee`, `isAccountant`, or `hasAdminAccess` from the auth context.

### Optional Cleanup (1 step)

**Remove unused role booleans from AuthContext** — The properties `isAdmin`, `isManager`, `isHR`, `isEmployee`, `isAccountant`, and `hasAdminAccess` are exported from `AuthContext` but no longer consumed anywhere. Removing them simplifies the auth context and prevents future developers from using hardcoded role checks instead of `usePermissions()`.

**File**: `src/contexts/AuthContext.tsx`
- Remove `isAdmin`, `isManager`, `isHR`, `isEmployee`, `isAccountant`, `hasAdminAccess` from the interface, computed values, and provider value object
- Keep only `role` (string) which is used by `usePermissions()` calls throughout the app

