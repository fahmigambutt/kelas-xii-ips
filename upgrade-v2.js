/* XII IPS Upgrade V2 - non-module enhancement layer */
(() => {
  'use strict';

  const STORAGE_KEY = 'xii-ips-custom-background-v2';
  const root = document.documentElement;
  let appBackgroundValue = root.style.getPropertyValue('--background-image') || '';
  let customBackground = '';

  function runWhenReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function enhanceLoader() {
    const loader = document.querySelector('#loading-screen');
    if (!loader || loader.querySelector('.loading-progress')) return;

    const messages = [
      'Menyiapkan ruang kelas digital…',
      'Menyusun cerita dan kenangan…',
      'Menghubungkan keluarga XII IPS…',
      'Hampir selesai…'
    ];

    const status = document.createElement('div');
    status.className = 'loading-status';
    status.setAttribute('aria-live', 'polite');
    status.textContent = messages[0];

    const progress = document.createElement('div');
    progress.className = 'loading-progress';
    progress.setAttribute('aria-hidden', 'true');
    progress.innerHTML = '<span></span>';

    const skipButton = loader.querySelector('#skip-loading');
    if (skipButton) {
      loader.insertBefore(status, skipButton);
      loader.insertBefore(progress, skipButton);
    } else {
      loader.append(status, progress);
    }

    let index = 0;
    const interval = window.setInterval(() => {
      index = Math.min(index + 1, messages.length - 1);
      status.textContent = messages[index];
      if (index === messages.length - 1) window.clearInterval(interval);
    }, 760);

    const observer = new MutationObserver(() => {
      if (loader.classList.contains('is-hidden') || loader.hidden) {
        window.clearInterval(interval);
        observer.disconnect();
        document.body.classList.add('v2-ready');
      }
    });
    observer.observe(loader, { attributes: true, attributeFilter: ['class', 'hidden'] });
  }

  function classifyRole(roleText) {
    const role = String(roleText || '').trim().toLowerCase();
    if (/wali kelas|guru|pembina/.test(role)) return 'wali';
    if (/ketua|wakil/.test(role)) return 'leadership';
    if (/sekretaris|bendahara/.test(role)) return 'administration';
    if (/koordinator|seksi|sie\b/.test(role)) return 'coordinators';
    return 'other';
  }

  function enhanceStructure() {
    const grid = document.querySelector('#structure-grid');
    if (!grid || grid.dataset.v2Upgrading === 'true') return;

    const directCards = Array.from(grid.children).filter((element) =>
      element instanceof HTMLElement && element.matches('.profile-card[data-entity="structure"]')
    );

    if (!directCards.length) return;

    grid.dataset.v2Upgrading = 'true';
    const groups = {
      wali: [],
      leadership: [],
      administration: [],
      coordinators: [],
      other: []
    };

    directCards.forEach((card) => {
      const role = card.querySelector('.role')?.textContent || '';
      const level = classifyRole(role);
      card.dataset.orgLevel = level;
      groups[level].push(card);
    });

    const labels = {
      wali: 'Wali kelas',
      leadership: 'Pimpinan kelas',
      administration: 'Administrasi kelas',
      coordinators: 'Koordinator bidang',
      other: 'Pengurus lainnya'
    };

    const fragment = document.createDocumentFragment();
    ['wali', 'leadership', 'administration', 'coordinators', 'other'].forEach((level) => {
      if (!groups[level].length) return;
      const section = document.createElement('section');
      section.className = `org-level org-level--${level}`;
      section.setAttribute('aria-label', labels[level]);
      groups[level].forEach((card) => section.appendChild(card));
      fragment.appendChild(section);
    });

    grid.classList.add('org-chart');
    grid.replaceChildren(fragment);
    queueMicrotask(() => { delete grid.dataset.v2Upgrading; });
  }

  function observeStructure() {
    const grid = document.querySelector('#structure-grid');
    if (!grid) return;

    enhanceStructure();
    const observer = new MutationObserver(() => window.requestAnimationFrame(enhanceStructure));
    observer.observe(grid, { childList: true });
  }

  function escapeCssUrl(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function setCustomBackground(dataUrl, persist = true) {
    if (!dataUrl) return;
    customBackground = dataUrl;
    const cssValue = `url("${escapeCssUrl(dataUrl)}")`;
    root.style.setProperty('--background-image', cssValue);
    if (persist) localStorage.setItem(STORAGE_KEY, dataUrl);
  }

  function restoreAppBackground() {
    customBackground = '';
    localStorage.removeItem(STORAGE_KEY);
    if (appBackgroundValue) {
      root.style.setProperty('--background-image', appBackgroundValue);
    } else {
      root.style.removeProperty('--background-image');
    }
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Foto tidak dapat dibaca. Gunakan JPG, PNG, atau WebP.'));
      };
      image.src = objectUrl;
    });
  }

  async function compressImage(file, maxDimension = 1500, quality = 0.78) {
    const image = await loadImage(file);
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    const ratio = longest > maxDimension ? maxDimension / longest : 1;
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Browser tidak mendukung pemrosesan gambar.');

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, width, height);

    let result = canvas.toDataURL('image/webp', quality);
    if (!result.startsWith('data:image/webp')) {
      result = canvas.toDataURL('image/jpeg', quality);
    }
    return result;
  }

  function createBackgroundPersonalizer() {
    if (document.querySelector('.background-personalizer')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'background-personalizer';
    wrapper.innerHTML = `
      <section class="background-personalizer__panel" id="background-personalizer-panel" hidden>
        <h3>Personalisasi Latar</h3>
        <p>Pilih foto dari perangkat. Perubahan ini hanya tersimpan di HP atau komputer ini dan tidak mengubah latar untuk pengunjung lain.</p>
        <div class="background-personalizer__actions">
          <label class="button button-primary">Pilih Foto<input type="file" accept="image/jpeg,image/png,image/webp" hidden></label>
          <button class="button button-secondary" type="button" data-reset-background>Reset</button>
        </div>
        <span class="background-personalizer__status" role="status" aria-live="polite"></span>
      </section>
      <button class="background-personalizer__toggle" type="button" aria-label="Personalisasi latar belakang" aria-expanded="false" aria-controls="background-personalizer-panel">✦</button>
    `;

    document.body.appendChild(wrapper);
    const panel = wrapper.querySelector('.background-personalizer__panel');
    const toggle = wrapper.querySelector('.background-personalizer__toggle');
    const input = wrapper.querySelector('input[type="file"]');
    const reset = wrapper.querySelector('[data-reset-background]');
    const status = wrapper.querySelector('.background-personalizer__status');

    const closePanel = () => {
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    };

    toggle.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      toggle.setAttribute('aria-expanded', String(!panel.hidden));
    });

    document.addEventListener('pointerdown', (event) => {
      if (!panel.hidden && !wrapper.contains(event.target)) closePanel();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !panel.hidden) closePanel();
    });

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        status.textContent = 'Format foto harus JPG, PNG, atau WebP.';
        input.value = '';
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        status.textContent = 'Ukuran foto maksimal 15 MB.';
        input.value = '';
        return;
      }

      status.textContent = 'Memproses foto…';
      try {
        let dataUrl = await compressImage(file, 1500, 0.78);
        if (dataUrl.length > 3_800_000) dataUrl = await compressImage(file, 1100, 0.68);
        setCustomBackground(dataUrl, true);
        status.textContent = 'Latar berhasil diganti dan disimpan di perangkat ini.';
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal mengganti latar.';
        status.textContent = message;
      } finally {
        input.value = '';
      }
    });

    reset.addEventListener('click', () => {
      restoreAppBackground();
      status.textContent = 'Latar dikembalikan ke pengaturan website.';
    });
  }

  function initializeBackground() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCustomBackground(saved, false);
    } catch (error) {
      console.warn('Latar personal tidak dapat dimuat:', error);
    }

    document.addEventListener('xii:data', () => {
      window.setTimeout(() => {
        const current = root.style.getPropertyValue('--background-image');
        const customCssValue = customBackground ? `url("${escapeCssUrl(customBackground)}")` : '';
        if (current && current !== customCssValue) appBackgroundValue = current;
        if (customBackground) setCustomBackground(customBackground, false);
      }, 0);
    });
  }

  runWhenReady(() => {
    enhanceLoader();
    observeStructure();
    initializeBackground();
    createBackgroundPersonalizer();
  });
})();
