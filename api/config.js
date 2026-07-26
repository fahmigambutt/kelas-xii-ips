import { sendJson } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Metode tidak diizinkan.' });
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
  return sendJson(res, 200, { configured: Boolean(supabaseUrl && supabaseAnonKey), supabaseUrl, supabaseAnonKey });
}
