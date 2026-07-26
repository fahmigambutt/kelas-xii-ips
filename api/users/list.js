import { requireMethod, requireSuperAdmin, sendJson, handleApiError } from '../_shared.js';

export default async function handler(req, res) {
  try {
    requireMethod(req, ['GET']);
    const { admin } = await requireSuperAdmin(req);
    const { data, error } = await admin.from('profiles').select('id, full_name, email, role, is_active, must_change_password, created_at, updated_at, created_by, last_login_at').order('created_at', { ascending: false });
    if (error) throw error;
    return sendJson(res, 200, { users: data || [] });
  } catch (error) { return handleApiError(res, error); }
}
