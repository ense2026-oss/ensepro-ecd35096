

## Plan: Notification System for All Request Types

### Problem
Currently, submitting leave/OT/time-edit requests does not notify approvers (Admin/HR). Approving or rejecting does not notify the requester. The time-edit notification only notifies the current user (self), which is incorrect.

### Approach
Create a shared utility function `sendRequestNotification` that handles all notification scenarios. This function will:
1. On **new request**: notify all Admin/HR users
2. On **approve/reject**: notify the requesting employee

### Technical Details

**1. New file: `src/utils/notifications.ts`**
- `notifyApprovers(params)` — queries `user_roles` for admin/hr users, then inserts `app_notifications` for each
- `notifyRequester(params)` — looks up the employee's `user_id` from `employees` table, inserts notification
- Both functions accept: `type` (leave/ot/attendance), `title`, `description`, `targetEmployee`, optional `actionLabel`

**2. Modify `src/pages/Leave.tsx`**
- After inserting a new leave request: call `notifyApprovers` with type "leave"
- In `handleApprove` / `handleReject`: call `notifyRequester` to notify the employee who submitted

**3. Modify `src/pages/OvertimeRequest.tsx`**
- After inserting a new OT request: call `notifyApprovers` with type "ot"
- In `handleApprove` / `handleReject`: call `notifyRequester`

**4. Modify `src/contexts/TimeEditContext.tsx`**
- In `addEditRequest`: replace self-notification with `notifyApprovers` with type "attendance"

**5. Modify `src/pages/Attendance.tsx`**
- In `handleApprove` / `handleReject`: call `notifyRequester` for the time-edit requester

**6. Notification content examples**
- New request: `"[ชื่อพนักงาน] ยื่นขอลา ลาป่วย 2 วัน"` → sent to Admin/HR
- Approved: `"คำขอลาของคุณได้รับการอนุมัติแล้ว"` → sent to requester
- Rejected: `"คำขอ OT ของคุณไม่ได้รับการอนุมัติ"` → sent to requester

### No database changes needed
The `app_notifications` table and its RLS policies already support this — we just need to insert rows with the correct `user_id` for each recipient. The existing RLS allows admin/hr/manager/executive to insert notifications for any user.

