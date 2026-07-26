import { requireMethod, parseBody, cleanText, validateEmail, validateRole, requireSuperAdmin, writeAudit, sendJson, handleApiError, HttpError } from '../_shared.js';

export default async function handler(req, res) {
  try {
    requireMethod(req, ['POST']);
    const { admin, profile: actor } = await requireSuperAdmin(req);
    const body = parseBody(req);
    const fullName = cleanText(body.full_name, 100);
    const email = validateEmail(body.email);
    const role = validateRole(body.role || 'editor');
    const method = body.method === 'temporary_password' ? 'temporary_password' : 'invite';
    if (fullName.length < 2) throw new HttpError(400, 'Nama lengkap minimal 2 karakter.');

    let createdUser;
    let mustChangePassword = false;
    if (method === 'invite') {
      const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '';
      const redirectTo = host ? `https://${host}` : undefined;
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { full_name: fullName }
      });
      if (error) throw new HttpError(400, error.message);
      createdUser = data.user;
    } else {
      const password = String(body.temporary_password || '');
      if (password.length < 10) throw new HttpError(400, 'Password sementara minimal 10 karakter.');
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
        app_metadata: { role }
      });
      if (error) throw new HttpError(400, error.message);
      createdUser = data.user;
      mustChangePassword = true;
    }

    const profilePayload = {
      id: createdUser.id,
      full_name: fullName,
      email,
      role,
      is_active: body.is_active !== false,
      must_change_password: mustChangePassword,
      created_by: actor.id
    };
    const { error: profileError } = await admin.from('profiles').upsert(profilePayload, { onConflict: 'id' });
    if (profileError) {
      await admin.auth.admin.deleteUser(createdUser.id).catch(() => null);
      throw new HttpError(500, 'Akun Auth dibuat tetapi profil gagal disimpan. Perubahan telah dibatalkan.');
    }
    await admin.auth.admin.updateUserById(createdUser.id, { app_metadata: { role } });
    if (body.is_active === false) await admin.auth.admin.updateUserById(createdUser.id, { ban_duration: '876000h' });
    await writeAudit(admin, actor, 'create_user', 'profiles', createdUser.id, null, profilePayload);
    return sendJson(res, 201, { success: true, id: createdUser.id, method });
  } catch (error) { return handleApiError(res, error); }
}
