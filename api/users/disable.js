import { requireMethod, parseBody, requireSuperAdmin, assertTargetExists, assertNotLastActiveSuperAdmin, writeAudit, sendJson, handleApiError, HttpError } from '../_shared.js';

export default async function handler(req, res) {
  try {
    requireMethod(req, ['POST']);
    const { admin, user: caller, profile: actor } = await requireSuperAdmin(req);
    const { id } = parseBody(req);
    const target = await assertTargetExists(admin, id);
    if (caller.id === target.id) throw new HttpError(409, 'Anda tidak dapat menonaktifkan akun sendiri.');
    await assertNotLastActiveSuperAdmin(admin, target, 'menonaktifkan');
    const { error: authError } = await admin.auth.admin.updateUserById(id, { ban_duration: '876000h' });
    if (authError) throw new HttpError(400, authError.message);
    const { error } = await admin.from('profiles').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    await writeAudit(admin, actor, 'disable_user', 'profiles', id, target, { ...target, is_active: false });
    return sendJson(res, 200, { success: true });
  } catch (error) { return handleApiError(res, error); }
}
