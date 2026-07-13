# Fix "ไม่พบข้อมูลพนักงาน" false-negative on employee profile

## Problem
Opening `/employees/:id` directly (or refreshing) shows "ไม่พบข้อมูลพนักงาน" even for Admin / Executive / HR, even though the employee exists and the user has permission. Database RLS is correct — this is a client-side timing bug in `src/pages/EmployeeProfile.tsx`.

## Root cause
1. The not-found block renders as soon as `getEmployeeById(id)` is `undefined`, without waiting for `EmployeeContext`'s `loading` flag. On first load the employee list is still empty.
2. Local `data` state is set only from the one-time `useState` initializer. When the list finishes loading, `employee` becomes defined but `data` stays `null` forever, so the not-found screen never recovers.

## Changes (only `src/pages/EmployeeProfile.tsx`)

1. **Consume the `loading` flag** from `useEmployees()` (already exposed by the context).

2. **Show a loading state instead of not-found while data is arriving.** Before the not-found check, render a spinner/placeholder when `loading` is true, or when `employee` is not yet resolved and the list hasn't loaded.

3. **Sync `data` when `employee` becomes available.** Add a `useEffect` keyed on the employee (e.g. `employee?.id`) that copies the employee into `data` when `data` is still `null` and the user is not mid-edit, so a late-arriving list populates the profile.

4. **Keep the real not-found path** — only render "ไม่พบข้อมูลพนักงาน" once `loading` is `false` AND the employee is genuinely absent from the loaded list.

## Technical details
- `EmployeeContext` already exposes `loading`; no context or DB changes needed.
- Guard order in render: `if (loading && !employee) return <Spinner/>;` then the sync effect ensures `data` is set; the existing `if (!employee || !data)` not-found block stays but is only reached after loading completes.
- The sync effect must not clobber in-progress edits (skip when `isEditing`).

## Verification
- Typecheck with `tsgo --noEmit`.
- Load `/employees/c044ab8b-77d1-423a-b2f6-5f16420c6dbb` directly and on refresh as Executive — profile renders instead of the not-found screen.
- Confirm a genuinely invalid ID still shows the not-found screen after loading.
