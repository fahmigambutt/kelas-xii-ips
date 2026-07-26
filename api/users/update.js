import { requireMethod, parseBody, cleanText, validateEmail, validateRole, requireSuperAdmin, assertTargetExists, assertNotLastActiveSuperAdmin, writeAudit, sendJson, handleApiError, HttpError } from '../_shared.js';

export default async function handler(req, res) {
  try {
    requireMethod(req, ['PATCH']);
    const { admin, user: caller, profile: actor } = await requireSuperAdmin(req);
    const body = parseBody(req);
    const target = await assertTargetExists(admin, body.id);
    const fullName = cleanText(body.full_name ?? target.full_name, 100);
    const email = validateEmail(body.email ?? target.email);
    const role = validateRole(body.role ?? target.role);
    if (fullName.length < 2) throw new HttpError(400, 'Nama lengkap minimal 2 karakter.');
    if (caller.id === target.id && role !== target.role) throw new HttpError(409, 'Anda tidak dapat mengubah role akun sendiri.');
    if (target.role === 'super_admin' && role !== 'super_admin') await assertNotLastActiveSuperAdmin(admin, target, 'menurunkan role');

    const { error: authError } = await admin.auth.admin.updateUserById(target.id, {
      email,
      user_metadata: { full_name: fullName },
      app_metadata: { role }
    });
    if (authError) throw new HttpError(400, authError.message);
    const next = { full_name: fullName, email, role, updated_at: new Date().toISOString() };
    const { error } = await admin.from('profiles').update(next).eq('id', target.id);
    if (error) throw error;
    await writeAudit(admin, actor, role !== target.role ? 'change_role' : 'update_user', 'profiles', target.id, target, { ...target, ...next });
    return sendJson(res, 200, { success: true });
  } catch (error) { return handleApiError(res, error); }
}
