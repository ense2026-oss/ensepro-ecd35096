

## Plan: Optimize Login-to-Dashboard Loading Performance

### Problem Analysis

After login, the user experiences a long loading time. Here's the chain of events causing the delay:

```text
Login submit
  → Supabase auth (network call ~300-500ms)
  → AuthContext: getSession + fetchProfileAndRole (3 parallel queries ~500ms)
  → Wait for profileReady + permLoading
  → PermissionsContext: fetch role_permissions (~300ms)
  → MainLayout renders → redirect to /dashboard
  → Dashboard: fetchAll (7+ parallel DB queries ~500-800ms)
  → EmployeeContext: fetch all employees + education/work/payroll (~500ms)
  → PendingCountsContext: fetch notification + pending counts (~300ms)
  → BrandingContext: fetch branding from company_settings (~200ms)
```

Total waterfall: **~2.5-4 seconds** of sequential network calls before the user sees content.

### Approach — 5 Optimizations

**1. Remove double auth check (eliminate ~500ms)**
- `AuthContext.onAuthStateChange` fires AFTER `getSession`, causing `fetchProfileAndRole` to run **twice** on login
- Fix: skip re-fetching in `onAuthStateChange` if profile data already matches the same user ID

**2. Lazy-load heavy contexts (eliminate ~500ms from initial render)**
- `EmployeeContext` fetches ALL employees on mount — this blocks the layout even if user goes to Dashboard (which fetches its own employee data)
- Defer `EmployeeContext.fetchEmployees()` with a short timeout (e.g., 500ms) so it doesn't block initial render
- Same for `OrgContext` — it's not needed on Dashboard

**3. Parallelize PermissionsContext with AuthContext (save ~300ms)**
- Currently permissions wait for auth to complete, then fetch sequentially
- Start permissions fetch as soon as `user` is available, without waiting for `profileReady`

**4. Show Dashboard skeleton immediately (perceived performance)**
- Currently MainLayout shows a blank spinner until ALL contexts are ready
- Instead: render the Dashboard layout with skeleton cards immediately once `user` exists, let data fill in progressively
- Remove the `permLoading` gate from MainLayout — permissions can load in background

**5. Cache branding in localStorage (save ~200ms on reload)**
- Load branding from localStorage instantly on mount
- Fetch from DB in background and update if changed
- This prevents the login page from flickering while branding loads

### Files to Modify

| File | Change |
|------|--------|
| `src/contexts/AuthContext.tsx` | Skip duplicate fetchProfileAndRole when same user |
| `src/contexts/PermissionsContext.tsx` | Start fetch on `user` instead of waiting for full profile |
| `src/contexts/EmployeeContext.tsx` | Defer initial fetch with setTimeout |
| `src/contexts/BrandingContext.tsx` | Add localStorage cache layer |
| `src/components/layout/MainLayout.tsx` | Remove `permLoading` from blocking gate, show content sooner |
| `src/pages/Dashboard.tsx` | No changes needed (already has skeleton loading) |

### Impact
- Estimated reduction: **1.5-2 seconds** off the login-to-content time
- No functional changes — same data, same UI, just faster loading sequence

