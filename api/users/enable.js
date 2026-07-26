import { requireMethod, parseBody, requireSuperAdmin, assertTargetExists, writeAudit, sendJson, handleApiError, HttpError } from '../_shared.js';

export default async function handler(req, res) {
  try {
    requireMethod(req, ['POST']);
    const { admin, profile: actor } = await requireSuperAdmin(req);
    const { id } = parseBody(req);
    const target = await assertTargetExists(admin, id);
    const { error: authError } = await admin.auth.admin.updateUserById(id, { ban_duration: 'none' });
    if (authError) throw new HttpError(400, authError.message);
    const { error } = await admin.from('profiles').update({ is_active: true, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    await writeAudit(admin, actor, 'enable_user', 'profiles', id, target, { ...target, is_active: true });
    return sendJson(res, 200, { success: true });
  } catch (error) { return handleApiError(res, error); }
}
