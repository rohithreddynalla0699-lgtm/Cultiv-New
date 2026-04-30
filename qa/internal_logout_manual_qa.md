# Manual QA for Internal Session Logout Revocation (Task 1)

## Steps

1. **Login as owner/admin/store:**
   - Use the internal login flow to authenticate as an owner, admin, or store user.

2. **Confirm session row exists:**
   - In Supabase SQL editor, run:
     ```sql
     select * from public.internal_access_sessions where revoked_at is null and internal_user_id = '<your_user_id>' order by created_at desc limit 1;
     ```
   - Confirm a row exists with `revoked_at` as null.

3. **Logout:**
   - Use the app's internal logout button/flow.

4. **Confirm session revoked:**
   - Re-run the SQL above. The same session row should now have `revoked_at` populated and `revoked_reason = 'logout'`.

5. **Token invalidation:**
   - Try using the old session token (e.g., via API or by not refreshing the page) to call any internal edge function. It should fail (401/403 or equivalent error).

6. **Repeat logout:**
   - Logout again (with no valid session). No error should occur; the response is always success.

## Notes
- No DB migration is needed; the table already supports `revoked_at` and `revoked_reason`.
- Frontend always clears local state, even if backend logout fails.
- No sensitive session/token details are exposed in responses.

## Edge Cases
- Logging out with an already revoked or expired session: still returns success.
- Logging out with no session: still returns success.

---

**Tested on:** [date]
**Tested by:** [name]
