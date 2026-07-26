import { initializeConfig, runtimeConfig } from './config.js';
import { initializeAuth, subscribeAuth, getAuthState } from './auth.js';
import { loadPublicData, subscribeData, startRealtimeSync } from './data.js';
import { initializeUI, renderSkeletons, renderAll, refreshAuthUI, startPostDataUI, toast, openChangePasswordModal } from './ui.js';
import { initializeEditor } from './editor.js';

async function bootstrap() {
  initializeUI();
  initializeEditor();
  renderSkeletons();

  try {
    await initializeConfig();
    await Promise.all([loadPublicData(), initializeAuth()]);
    renderAll();
    startPostDataUI();
    if (runtimeConfig.configured) startRealtimeSync();
    else toast('Mode demo lokal aktif. Hubungkan environment variables untuk login dan penyimpanan online.', 'info', 5200);
  } catch (error) {
    console.error(error);
    renderAll();
    startPostDataUI();
    toast(`Website dimuat dengan data lokal: ${error.message}`, 'error', 6500);
  }
}

subscribeData((data) => renderAll(data));
subscribeAuth((state, event) => {
  refreshAuthUI(state);
  if (event === 'ACCOUNT_DISABLED') toast('Akun telah dinonaktifkan.', 'error');
  if (event === 'PASSWORD_RECOVERY') openChangePasswordModal(true);
  if (state.profile?.must_change_password && event === 'SIGNED_IN') openChangePasswordModal(true);
});

document.addEventListener('DOMContentLoaded', bootstrap, { once:true });
