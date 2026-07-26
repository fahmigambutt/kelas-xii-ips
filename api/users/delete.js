import { requireMethod, parseBody, requireSuperAdmin, assertTargetExists, assertNotLastActiveSuperAdmin, writeAudit, sendJson, handleApiError, HttpError } from '../_shared.js';

export default async function handler(req, res) {
  try {
    requireMethod(req, ['DELETE']);
    const { admin, user: caller, profile: actor } = await requireSuperAdmin(req);
    const { id } = parseBody(req);
    const target = await assertTargetExists(admin, id);
    if (caller.id === target.id) throw new HttpError(409, 'Anda tidak dapat menghapus akun sendiri.');
    await assertNotLastActiveSuperAdmin(admin, target, 'menghapus');
    await writeAudit(admin, actor, 'delete_user', 'profiles', id, target, null);
    const { error } = await admin.auth.admin.deleteUser(id, false);
    if (error) throw new HttpError(400, error.message);
    return sendJson(res, 200, { success: true });
  } catch (error) { return handleApiError(res, error); }
}
