import { requireMethod, requireSuperAdmin, sendJson, handleApiError } from '../_shared.js';

export default async function handler(req, res) {
  try {
    requireMethod(req, ['GET']);
    const { admin } = await requireSuperAdmin(req);
    const { data, error } = await admin.from('audit_logs').select('id, user_id, user_name, action, entity_type, entity_id, old_data, new_data, created_at').order('created_at', { ascending: false }).limit(500);
    if (error) throw error;
    return sendJson(res, 200, { logs: data || [] });
  } catch (error) { return handleApiError(res, error); }
}
