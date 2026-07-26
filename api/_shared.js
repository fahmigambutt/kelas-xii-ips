import { createClient } from '@supabase/supabase-js';

const allowedRoles = new Set(['editor', 'super_admin']);
let cachedAdmin = null;

export function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new HttpError(500, 'Environment Supabase server belum lengkap.');
  cachedAdmin ||= createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
  return cachedAdmin;
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}

export function requireMethod(req, allowed) {
  if (!allowed.includes(req.method)) throw new HttpError(405, 'Metode tidak diizinkan.');
}

export function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch { throw new HttpError(400, 'Body JSON tidak valid.'); }
}

export function cleanText(value, max = 200) {
  return String(value ?? '').trim().replace(/[<>\u0000-\u001f]/g, '').slice(0, max);
}

export function validateEmail(value) {
  const email = cleanText(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Format email tidak valid.');
  return email;
}

export function validateRole(value) {
  const role = String(value || 'editor');
  if (!allowedRoles.has(role)) throw new HttpError(400, 'Role tidak valid.');
  return role;
}

export async function requireSuperAdmin(req) {
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new HttpError(401, 'Access token tidak tersedia.');
  const admin = getAdminClient();
  const { data: userData, error: userError } = await admin.auth.getUser(match[1]);
  if (userError || !userData?.user) throw new HttpError(401, 'Sesi tidak valid atau telah berakhir.');
  const { data: profile, error: profileError } = await admin.from('profiles').select('*').eq('id', userData.user.id).maybeSingle();
  if (profileError || !profile) throw new HttpError(403, 'Profil pengelola tidak ditemukan.');
  if (!profile.is_active) throw new HttpError(403, 'Akun sedang dinonaktifkan.');
  if (profile.role !== 'super_admin') throw new HttpError(403, 'Hanya Super Admin yang diizinkan.');
  return { admin, user: userData.user, profile };
}

export async function assertTargetExists(admin, id) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, 'ID pengguna tidak valid.');
  const { data, error } = await admin.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error || !data) throw new HttpError(404, 'Akun tidak ditemukan.');
  return data;
}

export async function assertNotLastActiveSuperAdmin(admin, target, operation = 'mengubah') {
  if (target.role !== 'super_admin' || !target.is_active) return;
  const { count, error } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'super_admin').eq('is_active', true);
  if (error) throw new HttpError(500, 'Gagal memeriksa jumlah Super Admin.');
  if ((count || 0) <= 1) throw new HttpError(409, `Tidak dapat ${operation} satu-satunya Super Admin aktif.`);
}

export async function writeAudit(admin, actor, action, entityType, entityId, oldData = null, newData = null) {
  const { error } = await admin.from('audit_logs').insert({
    user_id: actor.id,
    user_name: actor.full_name || actor.email,
    action,
    entity_type: entityType,
    entity_id: entityId || null,
    old_data: oldData,
    new_data: newData
  });
  if (error) console.error('Audit insert failed:', error.message);
}

export function handleApiError(res, error) {
  console.error(error);
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof HttpError ? error.message : 'Terjadi kesalahan server.';
  return sendJson(res, status, { error: message });
}
