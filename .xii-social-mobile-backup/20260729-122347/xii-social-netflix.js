/* XII SOCIAL — Netflix-inspired final enhancement layer
 * Loaded after the original application modules.
 * Keeps the existing Supabase authentication/editor system intact.
 */
import { getAuthState } from './auth.js';
import { getData, saveChangeSet } from './data.js';
import { uploadImage, removeStoredFile, extractStoragePath } from './storage.js';
import { openModal, closeModal, toast, renderAll, escapeHtml } from './ui.js';

const BRAND_OLD = 'XII IPS';
const BRAND_NEW = 'XII SOCIAL';
const INSTAGRAM_HANDLE = '@XII.IPSBETHEONE';
const INSTAGRAM_URL = 'https://www.instagram.com/xii.ipsbetheone/';
const LOCAL_BACKGROUND_KEY = 'xii-ips-custom-background-v2';
const STRUCTURE_GROUPS = ['wali', 'leadership', 'administration', 'coordinators', 'other'];

let structureObserver = null;
let structureResizeObserver = null;
let structureFrame = 0;
let brandingFrame = 0;
let rebuildingStructure = false;

function onReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function replaceBrand(value) {
  return String(value ?? '').replace(/XII\s+IPS/gi, BRAND_NEW);
}

function escapeCssUrl(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function removeLegacyPersonalizer() {
  try {
    localStorage.removeItem(LOCAL_BACKGROUND_KEY);
  } catch (error) {
    console.warn('Penyimpanan latar lokal tidak dapat dibersihkan:', error);
  }
  document.querySelectorAll('.background-personalizer').forEach((element) => element.remove());
}

function ensureHeaderBrand() {
  const brand = document.querySelector('.brand-mini');
  if (!brand || document.querySelector('.xs-header-wordmark')) return;
  const wordmark = document.createElement('span');
  wordmark.className = 'xs-header-wordmark';
  wordmark.innerHTML = '<b>XII SOCIAL</b><small>OFFICIAL</small>';
  brand.insertAdjacentElement('afterend', wordmark);
}

function ensureInstagramLink() {
  const footer = document.querySelector('.site-footer');
  if (!footer || footer.querySelector('.xs-instagram-link')) return;
  const link = document.createElement('a');
  link.className = 'xs-instagram-link';
  link.href = INSTAGRAM_URL;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.setAttribute('aria-label', `Instagram ${BRAND_NEW}: ${INSTAGRAM_HANDLE}`);
  link.innerHTML = `<span aria-hidden="true">◎</span><strong>${INSTAGRAM_HANDLE}</strong>`;
  footer.insertBefore(link, footer.querySelector('#login-manager-button'));
}

function ensurePublicWallpaperLayer() {
  let layer = document.querySelector('#xs-public-wallpaper');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'xs-public-wallpaper';
    layer.setAttribute('aria-hidden', 'true');
    document.body.prepend(layer);
  }
  return layer;
}

function syncPublicWallpaper(data = getData()) {
  const layer = ensurePublicWallpaperLayer();
  const settings = data?.background_settings || {};
  const imageUrl = settings.image_url || './assets/defaults/default-background.webp';
  const position = settings.position || 'center';
  const brightness = Math.max(20, Math.min(100, Number(settings.brightness) || 65)) / 100;
  const scale = Math.max(100, Math.min(130, Number(settings.scale) || 108)) / 100;
  const overlay = Math.max(0, Math.min(90, Number(settings.overlay) || 35)) / 100;

  document.documentElement.style.setProperty('--xs-public-wallpaper', `url("${escapeCssUrl(imageUrl)}")`);
  document.documentElement.style.setProperty('--xs-wallpaper-position', position);
  document.documentElement.style.setProperty('--xs-wallpaper-brightness', String(brightness));
  document.documentElement.style.setProperty('--xs-wallpaper-scale', String(scale));
  document.documentElement.style.setProperty('--xs-wallpaper-overlay', String(overlay));
  layer.style.backgroundImage = `url("${escapeCssUrl(imageUrl)}")`;
  layer.style.backgroundPosition = position;
}

function replaceBrandingInDom() {
  cancelAnimationFrame(brandingFrame);
  brandingFrame = requestAnimationFrame(() => {
    document.title = replaceBrand(document.title || `${BRAND_NEW} — Official Class Website`);

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || !node.nodeValue?.match(/XII\s+IPS/i)) return NodeFilter.FILTER_REJECT;
        if (parent.closest('script, style, textarea, input, select, option, code, pre')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => { node.nodeValue = replaceBrand(node.nodeValue); });

    document.querySelectorAll('[alt], [aria-label], [title], [placeholder]').forEach((element) => {
      ['alt', 'aria-label', 'title', 'placeholder'].forEach((attribute) => {
        if (element.hasAttribute(attribute)) {
          element.setAttribute(attribute, replaceBrand(element.getAttribute(attribute)));
        }
      });
    });

    const metaTitle = document.querySelector('meta[property="og:title"], meta[name="twitter:title"]');
    if (metaTitle?.content) metaTitle.content = replaceBrand(metaTitle.content);
  });
}

function classifyRole(text) {
  const role = String(text || '').trim().toLowerCase();
  if (/wali kelas|guru|pembina/.test(role)) return 'wali';
  if (/ketua|wakil/.test(role)) return 'leadership';
  if (/sekretaris|bendahara/.test(role)) return 'administration';
  if (/koordinator|seksi|sie\b|keamanan|kebersihan|dokumentasi|peralatan|akademik|kreatif/.test(role)) return 'coordinators';
  return 'other';
}

function relativeCardRect(card, stageRect) {
  const rect = card.getBoundingClientRect();
  return {
    centerX: rect.left - stageRect.left + rect.width / 2,
    top: rect.top - stageRect.top,
    bottom: rect.bottom - stageRect.top
  };
}

function createSvgPath(svg, d, glow = false) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  if (glow) path.setAttribute('class', 'xs-tree-path-glow');
  svg.appendChild(path);
}

function connectParentToChildren(svg, parent, children) {
  if (!children.length) return;
  const firstTop = Math.min(...children.map((child) => child.top));
  const available = Math.max(24, firstTop - parent.bottom);
  const junctionY = parent.bottom + Math.min(42, available * 0.52);
  const xValues = children.map((child) => child.centerX);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const trunk = `M ${parent.centerX} ${parent.bottom} V ${junctionY}`;

  createSvgPath(svg, trunk, true);
  createSvgPath(svg, trunk);
  if (children.length > 1) {
    const branch = `M ${minX} ${junctionY} H ${maxX}`;
    createSvgPath(svg, branch, true);
    createSvgPath(svg, branch);
  }
  children.forEach((child) => {
    const stem = `M ${child.centerX} ${junctionY} V ${child.top}`;
    createSvgPath(svg, stem, true);
    createSvgPath(svg, stem);
  });
}

function drawStructureLines() {
  const stage = document.querySelector('#structure-grid > .xs-tree-stage');
  const svg = stage?.querySelector(':scope > .xs-tree-lines');
  if (!stage || !svg) return;
  const width = stage.scrollWidth;
  const height = stage.scrollHeight;
  if (!width || !height) return;

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.replaceChildren();

  const stageRect = stage.getBoundingClientRect();
  const levels = [...stage.querySelectorAll(':scope > .xs-tree-level')];
  for (let levelIndex = 0; levelIndex < levels.length - 1; levelIndex += 1) {
    const parents = [...levels[levelIndex].querySelectorAll(':scope > .profile-card')]
      .map((card) => relativeCardRect(card, stageRect));
    const children = [...levels[levelIndex + 1].querySelectorAll(':scope > .profile-card')]
      .map((card) => relativeCardRect(card, stageRect));
    if (!parents.length || !children.length) continue;

    const assignments = parents.map(() => []);
    children.forEach((child) => {
      let closest = 0;
      let distance = Number.POSITIVE_INFINITY;
      parents.forEach((parent, index) => {
        const current = Math.abs(parent.centerX - child.centerX);
        if (current < distance) {
          distance = current;
          closest = index;
        }
      });
      assignments[closest].push(child);
    });
    parents.forEach((parent, index) => connectParentToChildren(svg, parent, assignments[index]));
  }
}

function scheduleStructureLines() {
  cancelAnimationFrame(structureFrame);
  structureFrame = requestAnimationFrame(() => requestAnimationFrame(drawStructureLines));
}

function buildStructureTree() {
  const grid = document.querySelector('#structure-grid');
  if (!grid || rebuildingStructure) return;
  const directCards = [...grid.children].filter((element) =>
    element instanceof HTMLElement && element.matches('.profile-card[data-entity="structure"]')
  );
  if (!directCards.length) {
    if (grid.querySelector(':scope > .xs-tree-stage')) scheduleStructureLines();
    return;
  }

  rebuildingStructure = true;
  try {
    const groups = Object.fromEntries(STRUCTURE_GROUPS.map((group) => [group, []]));
    directCards.forEach((card) => {
      const group = classifyRole(card.querySelector('.role')?.textContent || '');
      card.dataset.orgLevel = group;
      groups[group].push(card);
    });

    const orderedGroups = STRUCTURE_GROUPS.filter((group) => groups[group].length);
    const maxCards = Math.max(1, ...orderedGroups.map((group) => groups[group].length));
    const mobile = matchMedia('(max-width: 720px)').matches;
    const cardWidth = mobile ? 192 : 244;
    const gap = mobile ? 20 : 30;
    const naturalWidth = maxCards * cardWidth + Math.max(0, maxCards - 1) * gap + (mobile ? 72 : 120);
    const minimumWidth = mobile ? 840 : 980;
    const stageWidth = Math.max(minimumWidth, naturalWidth, grid.clientWidth - 2);

    const stage = document.createElement('div');
    stage.className = 'xs-tree-stage';
    stage.style.width = `${stageWidth}px`;
    stage.style.setProperty('--xs-tree-card-width', `${cardWidth}px`);
    stage.style.setProperty('--xs-tree-gap', `${gap}px`);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('xs-tree-lines');
    svg.setAttribute('aria-hidden', 'true');
    stage.appendChild(svg);

    const levelLabels = {
      wali: 'Wali kelas',
      leadership: 'Pimpinan kelas',
      administration: 'Administrasi kelas',
      coordinators: 'Koordinator bidang',
      other: 'Pengurus lainnya'
    };

    orderedGroups.forEach((group) => {
      const level = document.createElement('section');
      level.className = `xs-tree-level xs-tree-level--${group}`;
      level.setAttribute('aria-label', levelLabels[group]);
      groups[group].forEach((card) => level.appendChild(card));
      stage.appendChild(level);
    });

    grid.classList.add('xs-structure-tree');
    grid.replaceChildren(stage);

    let hint = grid.previousElementSibling;
    if (!hint?.classList.contains('xs-tree-hint')) {
      hint = document.createElement('p');
      hint.className = 'xs-tree-hint';
      hint.textContent = 'Geser ke kanan atau kiri untuk melihat seluruh struktur.';
      grid.before(hint);
    }

    structureResizeObserver?.disconnect();
    structureResizeObserver = new ResizeObserver(scheduleStructureLines);
    structureResizeObserver.observe(stage);
    stage.querySelectorAll('img').forEach((image) => {
      if (!image.complete) image.addEventListener('load', scheduleStructureLines, { once: true });
    });

    requestAnimationFrame(() => {
      grid.scrollLeft = Math.max(0, (stageWidth - grid.clientWidth) / 2);
      scheduleStructureLines();
    });
  } finally {
    rebuildingStructure = false;
  }
}

function rebuildStructureForViewport() {
  const grid = document.querySelector('#structure-grid');
  const stage = grid?.querySelector(':scope > .xs-tree-stage');
  if (!grid || !stage || rebuildingStructure) {
    buildStructureTree();
    return;
  }
  const cards = [...stage.querySelectorAll('.profile-card[data-entity="structure"]')];
  if (!cards.length) return;
  rebuildingStructure = true;
  try {
    structureResizeObserver?.disconnect();
    grid.replaceChildren(...cards);
  } finally {
    rebuildingStructure = false;
  }
  buildStructureTree();
}

function observeStructure() {
  const grid = document.querySelector('#structure-grid');
  if (!grid) return;
  structureObserver?.disconnect();
  structureObserver = new MutationObserver(() => {
    if (!rebuildingStructure) requestAnimationFrame(buildStructureTree);
  });
  structureObserver.observe(grid, { childList: true, subtree: false });
  buildStructureTree();
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(rebuildStructureForViewport, 120);
  }, { passive: true });
}

function normalizeBrandData(data) {
  const site = { ...data.site_settings };
  const labels = { ...data.labels };
  const about = { ...data.about };

  site.site_name = `${BRAND_NEW} — Official Class Website`;
  site.class_name = BRAND_NEW;
  site.welcome_text = `WELCOME ${BRAND_NEW}`;
  site.description = replaceBrand(site.description || `Ruang digital resmi keluarga ${BRAND_NEW}.`);
  site.closing_text = replaceBrand(site.closing_text || `Terima kasih telah menjadi bagian dari ${BRAND_NEW}.`);
  site.accent_color = '#e50914';
  site.theme_color = '#050505';

  labels.about_title = replaceBrand(labels.about_title || `Tentang ${BRAND_NEW}`);
  labels.structure_title = replaceBrand(labels.structure_title || `Struktur Organisasi ${BRAND_NEW}`);
  labels.members_title = replaceBrand(labels.members_title || `Anggota ${BRAND_NEW}`);
  labels.gallery_title = labels.gallery_title || 'Galeri Kenangan';

  Object.keys(about).forEach((key) => {
    if (typeof about[key] === 'string') about[key] = replaceBrand(about[key]);
  });
  return { site, labels, about };
}

function createMediaCard({ title, description, currentUrl, inputId, previewClass, buttonText, type }) {
  const safeUrl = escapeHtml(currentUrl || (type === 'logo' ? './assets/defaults/default-logo.webp' : './assets/defaults/default-background.webp'));
  return `
    <section class="xs-media-card" data-media-card="${type}">
      <div class="xs-media-preview ${previewClass}">
        <img src="${safeUrl}" alt="Pratinjau ${title}">
      </div>
      <div class="xs-media-copy">
        <p class="xs-media-kicker">PUBLIK</p>
        <h3>${title}</h3>
        <p>${description}</p>
        <label class="button button-secondary xs-file-button" for="${inputId}">Pilih Gambar</label>
        <input id="${inputId}" type="file" accept="image/jpeg,image/png,image/webp" hidden>
        <button class="button button-primary" type="button" data-save-media="${type}" disabled>${buttonText}</button>
        <p class="xs-media-status" role="status" aria-live="polite">Belum ada file baru dipilih.</p>
      </div>
    </section>`;
}

function isAllowedImage(file) {
  return file instanceof File && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 10 * 1024 * 1024;
}

async function removeOldPublicFile(oldUrl, bucket, newUrl) {
  if (!oldUrl || oldUrl === newUrl) return;
  const oldPath = extractStoragePath(oldUrl, bucket);
  if (oldPath) await removeStoredFile(bucket, oldPath).catch(() => null);
}

async function savePublicMedia(type, file, button, status) {
  const auth = getAuthState();
  if (!auth.canEdit || !document.body.classList.contains('is-editing')) {
    throw new Error('Hanya admin/pengelola yang sedang berada dalam Mode Edit yang dapat menyimpan media publik.');
  }
  if (!isAllowedImage(file)) throw new Error('Gunakan JPG, PNG, atau WebP dengan ukuran maksimal 10 MB.');

  const data = getData();
  const { site, labels, about } = normalizeBrandData(data);
  const bucket = type === 'logo' ? 'logos' : 'backgrounds';
  const oldUrl = type === 'logo' ? data.site_settings.logo_url : data.background_settings.image_url;
  let uploaded = null;

  button.disabled = true;
  status.textContent = 'Mengunggah gambar…';
  try {
    uploaded = await uploadImage(file, bucket, { userId: auth.user?.id || 'admin' });
    status.textContent = 'Menyimpan agar terlihat oleh semua pengunjung…';

    const upserts = {
      site_settings: [site],
      content_labels: [labels],
      about: [about]
    };
    if (type === 'logo') {
      site.logo_url = uploaded.url;
      upserts.site_settings = [site];
    } else {
      upserts.background_settings = [{ ...data.background_settings, image_url: uploaded.url }];
    }

    await saveChangeSet({ upserts, deletes: {} });
    await removeOldPublicFile(oldUrl, bucket, uploaded.url);
    renderAll();
    syncPublicWallpaper();
    replaceBrandingInDom();
    status.textContent = type === 'logo'
      ? 'Logo berhasil disimpan dan sudah tampil untuk publik.'
      : 'Wallpaper berhasil disimpan dan sudah tampil untuk publik sampai bagian paling bawah.';
    toast(type === 'logo' ? 'Logo publik berhasil disimpan.' : 'Wallpaper publik berhasil disimpan.');
    return true;
  } catch (error) {
    if (uploaded?.path) await removeStoredFile(bucket, uploaded.path).catch(() => null);
    throw error;
  } finally {
    button.disabled = false;
  }
}

function openPublicMediaManager() {
  const auth = getAuthState();
  if (!auth.canEdit || !document.body.classList.contains('is-editing')) {
    toast('Masuk sebagai admin/pengelola dan aktifkan Mode Edit terlebih dahulu.', 'error');
    return;
  }

  const data = getData();
  const content = document.createElement('div');
  content.className = 'xs-media-manager';
  content.innerHTML = `
    <div class="xs-media-intro">
      <p class="xs-media-kicker">ADMIN ONLY</p>
      <h3>Media Publik XII SOCIAL</h3>
      <p>Gambar baru hanya menjadi publik setelah tombol Simpan ditekan. Pengunjung tanpa login tidak dapat melihat tombol atau mengubah media.</p>
    </div>
    ${createMediaCard({
      title: 'Wallpaper Publik',
      description: 'Wallpaper ini tersimpan di Supabase dan tampil pada seluruh halaman, dari Home sampai Penutup, untuk semua perangkat dan pengunjung.',
      currentUrl: data.background_settings.image_url,
      inputId: 'xs-wallpaper-input',
      previewClass: 'is-wallpaper',
      buttonText: 'Simpan Wallpaper',
      type: 'wallpaper'
    })}
    ${createMediaCard({
      title: 'Logo Publik',
      description: 'Logo mempertahankan rasio asli agar tidak gepeng. Setelah disimpan, logo tampil di loading, header, Home, dan Penutup untuk publik.',
      currentUrl: data.site_settings.logo_url,
      inputId: 'xs-logo-input',
      previewClass: 'is-logo',
      buttonText: 'Simpan Logo',
      type: 'logo'
    })}`;

  const selected = { wallpaper: null, logo: null };
  const objectUrls = new Map();
  const releaseObjectUrls = () => {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.clear();
  };

  openModal({
    title: 'Kelola Wallpaper & Logo Publik',
    content,
    wide: true,
    closeOnOverlay: false,
    footer: '<button class="button button-secondary" type="button" data-close-media>Tutup</button>',
    onOpen(shell) {
      shell.querySelector('[data-close-media]')?.addEventListener('click', () => {
        releaseObjectUrls();
        closeModal();
      });
      shell.querySelector('.modal-close')?.addEventListener('click', releaseObjectUrls, { once: true });

      ['wallpaper', 'logo'].forEach((type) => {
        const card = shell.querySelector(`[data-media-card="${type}"]`);
        const input = card.querySelector('input[type="file"]');
        const preview = card.querySelector('.xs-media-preview img');
        const saveButton = card.querySelector(`[data-save-media="${type}"]`);
        const status = card.querySelector('.xs-media-status');

        input.addEventListener('change', () => {
          const file = input.files?.[0] || null;
          input.value = '';
          if (!file) return;
          if (!isAllowedImage(file)) {
            status.textContent = 'Format harus JPG/PNG/WebP dan maksimal 10 MB.';
            saveButton.disabled = true;
            selected[type] = null;
            return;
          }
          const previous = objectUrls.get(type);
          if (previous) URL.revokeObjectURL(previous);
          const objectUrl = URL.createObjectURL(file);
          objectUrls.set(type, objectUrl);
          selected[type] = file;
          preview.src = objectUrl;
          saveButton.disabled = false;
          status.textContent = `${file.name} siap disimpan untuk publik.`;
        });

        saveButton.addEventListener('click', async () => {
          if (!selected[type]) return;
          const originalText = saveButton.textContent;
          saveButton.textContent = type === 'logo' ? 'Menyimpan Logo…' : 'Menyimpan Wallpaper…';
          try {
            const saved = await savePublicMedia(type, selected[type], saveButton, status);
            if (saved) {
              selected[type] = null;
              saveButton.disabled = true;
              const current = objectUrls.get(type);
              if (current) URL.revokeObjectURL(current);
              objectUrls.delete(type);
            }
          } catch (error) {
            status.textContent = error instanceof Error ? error.message : 'Gagal menyimpan media.';
            toast(status.textContent, 'error', 6000);
          } finally {
            saveButton.textContent = originalText;
          }
        });
      });
    }
  });
}

function syncAdminMediaButton() {
  const toolbar = document.querySelector('#editor-toolbar .editor-actions');
  if (!toolbar) return;
  let button = toolbar.querySelector('#xs-media-manager-button');
  if (!button) {
    button = document.createElement('button');
    button.id = 'xs-media-manager-button';
    button.className = 'toolbar-button';
    button.type = 'button';
    button.textContent = 'Wallpaper & Logo';
    button.addEventListener('click', openPublicMediaManager);
    const settings = toolbar.querySelector('#settings-button');
    settings?.insertAdjacentElement('afterend', button);
    if (!settings) toolbar.appendChild(button);
  }
  const auth = getAuthState();
  button.hidden = !(auth.canEdit && document.body.classList.contains('is-editing'));
}

function observeAdminState() {
  const bodyObserver = new MutationObserver(syncAdminMediaButton);
  bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('xii:auth', syncAdminMediaButton);
  syncAdminMediaButton();
}

function initialize() {
  removeLegacyPersonalizer();
  ensureHeaderBrand();
  ensureInstagramLink();
  syncPublicWallpaper();
  replaceBrandingInDom();
  observeStructure();
  observeAdminState();

  document.addEventListener('xii:data', (event) => {
    removeLegacyPersonalizer();
    syncPublicWallpaper(event.detail?.data || getData());
    replaceBrandingInDom();
    requestAnimationFrame(buildStructureTree);
  });

  const publicObserver = new MutationObserver(() => {
    removeLegacyPersonalizer();
    ensureInstagramLink();
    ensureHeaderBrand();
    replaceBrandingInDom();
  });
  publicObserver.observe(document.body, { childList: true, subtree: true });
}

onReady(initialize);
