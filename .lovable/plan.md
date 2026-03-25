

## Investigation Results

### 1. Permission System — Working Correctly
The `role_permissions` table has correct data for all 6 roles (admin, hr, manager, employee, accountant, executive). The `PermissionsContext` loads this data and the Sidebar correctly filters menus using `canAccessRoute()`. **The permission system itself works.**

### 2. User Count Issue — RLS Problem
The "ผู้ใช้กำลังใช้ role นี้อยู่" count is **incorrect for non-admin users** due to RLS on `user_roles`:

- **Admin** sees all 14 users → correct counts
- **Non-admin** can only read their own row → sees only 1 user total

The `RolesSettings` component queries `user_roles` directly (line 108), but only admins have `SELECT ALL` on that table. Since only admins can access Settings, this is **not a functional bug** — the count will always be correct for the admin who sees it.

**However**, there's still a potential mismatch: the component counts from `user_roles.role` (enum values like `admin`, `employee`) but compares against `role_permissions.role_name` (text values). These happen to match by convention, but there's no foreign key enforcing it.

### 3. Real Issues Found

**Issue A: Saving permissions doesn't sync with `roleAccess.ts`**
The file `src/config/roleAccess.ts` has a hardcoded `menuAccessMap` that some parts of the app may still reference (e.g., `canAccess()`, `isSelfOnly()`). If admin changes permissions in the UI, only `role_permissions` DB table updates — the hardcoded config stays stale.

**Issue B: New roles created in UI won't work with auth**
If an admin creates a new custom role (e.g., "supervisor") via the UI, it gets saved to `role_permissions` but:
- The `app_role` enum in the database only has: `admin, moderator, user, hr, manager, employee, accountant, executive`
- `user_roles.role` is typed as `app_role` enum — you can't assign a custom role name
- So custom roles created in the UI **cannot actually be assigned to users**

**Issue C: RLS policies are hardcoded to specific roles**
All RLS policies use `has_role(auth.uid(), 'admin')` / `'hr'` / `'manager'` — they don't reference `role_permissions`. So even if you give "executive" full access in the UI, the database-level RLS still blocks them from writing to tables like `employees`, `contracts`, etc.

### Plan

#### Step 1: Update RLS policies for executive and accountant roles
Add `executive` and `accountant` to the relevant RLS policies so they match the permissions configured in `role_permissions`:

- **employees table**: Add executive (read all)
- **overtime_requests**: Add executive (full access)  
- **contracts**: Add executive (full access)
- **attendance_records**: Add executive (read all), accountant (read all)
- **check_in_records**: Add executive (read all)
- **leave_requests**: Update `can_access_leave` function to cover all roles with leave view permission

#### Step 2: Remove or deprecate `src/config/roleAccess.ts`
Search for all imports of `roleAccess.ts` and replace with `usePermissions()` calls. This eliminates the dual-source-of-truth problem.

#### Step 3: Fix user count display in RolesSettings
Instead of querying `user_roles` (which has RLS restrictions), count users from the `employees` table's `role` field which is readable by admins. Alternatively, since only admins access Settings, the current approach works — but we should add a comment noting this dependency.

#### Step 4: Disable "เพิ่ม Role" for custom roles (or document limitation)
Since `app_role` is a fixed enum, prevent admins from creating roles that can't be assigned. Either:
- Hide the "เพิ่ม Role" button and only allow editing existing roles
- Or add a note explaining that new roles require a database migration

### Files to modify
1. **Database migration** — Update RLS policies to include `executive` and `accountant` where their `role_permissions` grant access
2. **`src/config/roleAccess.ts`** — Check if still imported anywhere; if so, remove references
3. **`src/components/settings/RolesSettings.tsx`** — Disable adding new custom roles; improve user count accuracy
4. **`src/contexts/PermissionsContext.tsx`** — No changes needed (works correctly)

