/* XII IPS Upgrade V3 — Montfort-inspired enhancement layer */
(() => {
  'use strict';

  const SECTION_IDS = ['home', 'tentang', 'struktur', 'anggota', 'galeri', 'penutup'];
  const roleGroups = ['wali', 'leadership', 'administration', 'coordinators', 'other'];
  const root = document.documentElement;
  let treeFrame = 0;
  let rebuildFrame = 0;
  let treeObserver = null;
  let treeResizeObserver = null;

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function classifyRole(text) {
    const role = String(text || '').trim().toLowerCase();
    if (/wali kelas|guru|pembina/.test(role)) return 'wali';
    if (/ketua|wakil/.test(role)) return 'leadership';
    if (/sekretaris|bendahara/.test(role)) return 'administration';
    if (/koordinator|seksi|sie\b/.test(role)) return 'coordinators';
    return 'other';
  }

  function decorateLoader() {
    const loader = document.querySelector('#loading-screen');
    if (!loader || loader.querySelector('.mf-loader-mark')) return;

    const mark = document.createElement('span');
    mark.className = 'mf-loader-mark';
    mark.textContent = 'XII IPS / Digital Class Archive';

    const index = document.createElement('span');
    index.className = 'mf-loader-index';
    index.textContent = '26';

    loader.append(mark, index);
  }

  function decorateSections() {
    SECTION_IDS.forEach((id, index) => {
      const section = document.getElementById(id);
      if (!section) return;
      section.dataset.mfIndex = String(index + 1).padStart(2, '0');
    });

    document.querySelectorAll('.section-heading, .about-layout, .glass-quote, .member-controls, .gallery-toolbar, .member-grid, .gallery-grid, .closing-card')
      .forEach((element) => element.classList.add('mf-reveal'));

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('mf-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    document.querySelectorAll('.mf-reveal').forEach((element) => revealObserver.observe(element));
  }

  function createProgressRail() {
    if (document.querySelector('.mf-progress-rail')) return;

    const rail = document.createElement('aside');
    rail.className = 'mf-progress-rail';
    rail.setAttribute('aria-label', 'Progres halaman');
    rail.innerHTML = `
      <div class="mf-progress-track" aria-hidden="true"><span class="mf-progress-fill"></span></div>
      <div class="mf-progress-dots"></div>
    `;

    const dots = rail.querySelector('.mf-progress-dots');
    SECTION_IDS.forEach((id, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mf-progress-dot';
      button.dataset.target = id;
      button.setAttribute('aria-label', `Ke bagian ${index + 1}`);
      button.addEventListener('click', () => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      dots.appendChild(button);
    });

    document.body.appendChild(rail);

    const update = () => {
      const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, window.scrollY / scrollable));
      root.style.setProperty('--mf-progress', `${(progress * 100).toFixed(2)}%`);

      let activeIndex = 0;
      SECTION_IDS.forEach((id, index) => {
        const section = document.getElementById(id);
        if (!section) return;
        const rect = section.getBoundingClientRect();
        if (rect.top <= window.innerHeight * 0.46) activeIndex = index;
      });

      rail.querySelectorAll('.mf-progress-dot').forEach((dot, index) => {
        dot.classList.toggle('is-active', index === activeIndex);
      });
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
  }

  function enableHeroParallax() {
    const hero = document.querySelector('#home');
    if (!hero || matchMedia('(pointer: coarse)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    hero.addEventListener('pointermove', (event) => {
      const rect = hero.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / Math.max(1, rect.width) - .5) * 2;
      const y = ((event.clientY - rect.top) / Math.max(1, rect.height) - .5) * 2;
      hero.style.setProperty('--mf-x', x.toFixed(3));
      hero.style.setProperty('--mf-y', y.toFixed(3));
    }, { passive: true });

    hero.addEventListener('pointerleave', () => {
      hero.style.setProperty('--mf-x', '0');
      hero.style.setProperty('--mf-y', '0');
    });
  }

  function makeLevelsFromDirectCards(grid) {
    const directCards = Array.from(grid.children).filter((node) =>
      node instanceof HTMLElement && node.matches('.profile-card[data-entity="structure"]')
    );
    if (!directCards.length) return false;

    const groups = Object.fromEntries(roleGroups.map((name) => [name, []]));
    directCards.forEach((card) => {
      const role = card.querySelector('.role')?.textContent || '';
      const group = classifyRole(role);
      card.dataset.orgLevel = group;
      groups[group].push(card);
    });

    const fragment = document.createDocumentFragment();
    roleGroups.forEach((group) => {
      if (!groups[group].length) return;
      const level = document.createElement('section');
      level.className = `org-level org-level--${group}`;
      level.setAttribute('aria-label', group);
      groups[group].forEach((card) => level.appendChild(card));
      fragment.appendChild(level);
    });

    grid.classList.add('org-chart');
    grid.replaceChildren(fragment);
    return true;
  }

  function getGrid() {
    return document.querySelector('#structure-grid');
  }

  function getStage(grid) {
    return grid?.querySelector(':scope > .org-tree-stage-v3') || null;
  }

  function ensureTreeHint(grid) {
    const section = grid.closest('#struktur');
    if (!section || section.querySelector('.mf-tree-hint')) return;
    const hint = document.createElement('p');
    hint.className = 'mf-tree-hint';
    hint.textContent = 'Geser ke samping untuk melihat seluruh struktur';
    grid.before(hint);
  }

  function buildTreeStage() {
    const grid = getGrid();
    if (!grid) return false;

    if (getStage(grid)) {
      drawTreeSoon();
      return true;
    }

    makeLevelsFromDirectCards(grid);
    const levels = Array.from(grid.children).filter((node) =>
      node instanceof HTMLElement && node.matches('.org-level')
    );
    if (!levels.length) return false;

    const stage = document.createElement('div');
    stage.className = 'org-tree-stage-v3';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('org-tree-lines-v3');
    svg.setAttribute('aria-hidden', 'true');
    stage.appendChild(svg);

    let maximumCards = 1;
    levels.forEach((level) => {
      const cards = level.querySelectorAll(':scope > .profile-card[data-entity="structure"]');
      const count = Math.max(1, cards.length);
      maximumCards = Math.max(maximumCards, count);
      level.style.setProperty('--mf-node-count', String(count));
      stage.appendChild(level);
    });

    const cardWidth = window.innerWidth <= 520 ? 204 : 214;
    const gap = window.innerWidth <= 520 ? 30 : 34;
    const stageWidth = Math.max(1120, maximumCards * cardWidth + Math.max(0, maximumCards - 1) * gap + 180);
    stage.style.width = `${stageWidth}px`;

    grid.classList.add('org-chart', 'mf-tree');
    grid.replaceChildren(stage);
    ensureTreeHint(grid);

    if (treeResizeObserver) treeResizeObserver.disconnect();
    treeResizeObserver = new ResizeObserver(drawTreeSoon);
    treeResizeObserver.observe(stage);
    stage.querySelectorAll('img').forEach((image) => {
      if (!image.complete) image.addEventListener('load', drawTreeSoon, { once: true });
    });

    window.setTimeout(() => {
      grid.scrollLeft = Math.max(0, (stageWidth - grid.clientWidth) / 2);
    }, 80);

    drawTreeSoon();
    return true;
  }

  function relativeRect(element, stageRect) {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left - stageRect.left,
      right: rect.right - stageRect.left,
      top: rect.top - stageRect.top,
      bottom: rect.bottom - stageRect.top,
      centerX: rect.left - stageRect.left + rect.width / 2
    };
  }

  function createPath(svg, d, className = '') {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    if (className) path.setAttribute('class', className);
    svg.appendChild(path);
  }

  function drawParentGroup(svg, parent, children) {
    if (!children.length) return;
    const startY = parent.bottom;
    const targetTop = Math.min(...children.map((child) => child.top));
    const middleY = startY + Math.max(26, (targetTop - startY) * .5);
    const childXs = children.map((child) => child.centerX);
    const minimumX = Math.min(...childXs);
    const maximumX = Math.max(...childXs);

    const trunk = `M ${parent.centerX} ${startY} V ${middleY}`;
    createPath(svg, trunk, 'mf-tree-glow');
    createPath(svg, trunk);

    if (children.length > 1) {
      const branch = `M ${minimumX} ${middleY} H ${maximumX}`;
      createPath(svg, branch, 'mf-tree-glow');
      createPath(svg, branch);
    }

    children.forEach((child) => {
      const stem = `M ${child.centerX} ${middleY} V ${child.top}`;
      createPath(svg, stem, 'mf-tree-glow');
      createPath(svg, stem);
    });
  }

  function drawTree() {
    const grid = getGrid();
    const stage = getStage(grid);
    const svg = stage?.querySelector('.org-tree-lines-v3');
    if (!stage || !svg) return;

    const width = stage.clientWidth;
    const height = stage.scrollHeight;
    if (!width || !height) return;

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.replaceChildren();

    const stageRect = stage.getBoundingClientRect();
    const levels = Array.from(stage.querySelectorAll(':scope > .org-level'));

    for (let levelIndex = 0; levelIndex < levels.length - 1; levelIndex += 1) {
      const parentCards = Array.from(levels[levelIndex].querySelectorAll(':scope > .profile-card[data-entity="structure"]'));
      const childCards = Array.from(levels[levelIndex + 1].querySelectorAll(':scope > .profile-card[data-entity="structure"]'));
      if (!parentCards.length || !childCards.length) continue;

      const parents = parentCards.map((card) => relativeRect(card, stageRect));
      const children = childCards.map((card) => relativeRect(card, stageRect));
      const assigned = parents.map(() => []);

      children.forEach((child) => {
        let nearestIndex = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;
        parents.forEach((parent, index) => {
          const distance = Math.abs(parent.centerX - child.centerX);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
          }
        });
        assigned[nearestIndex].push(child);
      });

      parents.forEach((parent, index) => drawParentGroup(svg, parent, assigned[index]));
    }
  }

  function drawTreeSoon() {
    cancelAnimationFrame(treeFrame);
    treeFrame = requestAnimationFrame(() => requestAnimationFrame(drawTree));
  }

  function rebuildTreeSoon() {
    cancelAnimationFrame(rebuildFrame);
    rebuildFrame = requestAnimationFrame(() => {
      const grid = getGrid();
      if (!grid) return;

      const stage = getStage(grid);
      const hasDirectCards = Array.from(grid.children).some((node) =>
        node instanceof HTMLElement && node.matches('.profile-card[data-entity="structure"]')
      );
      const hasDirectLevels = Array.from(grid.children).some((node) =>
        node instanceof HTMLElement && node.matches('.org-level')
      );

      if ((hasDirectCards || hasDirectLevels) && stage) {
        if (treeResizeObserver) treeResizeObserver.disconnect();
        stage.remove();
      }

      buildTreeStage();
    });
  }

  function observeTree() {
    const grid = getGrid();
    if (!grid) return;

    if (treeObserver) treeObserver.disconnect();
    treeObserver = new MutationObserver((mutations) => {
      const externalChange = mutations.some((mutation) =>
        Array.from(mutation.addedNodes).some((node) =>
          node instanceof HTMLElement && (
            node.matches('.profile-card[data-entity="structure"], .org-level') ||
            node.querySelector?.('.profile-card[data-entity="structure"]')
          )
        )
      );
      if (externalChange) rebuildTreeSoon();
      else drawTreeSoon();
    });
    treeObserver.observe(grid, { childList: true, subtree: true });

    buildTreeStage();
    document.addEventListener('xii:data', () => window.setTimeout(rebuildTreeSoon, 50));
    window.addEventListener('resize', rebuildTreeSoon, { passive: true });
  }

  ready(() => {
    decorateLoader();
    decorateSections();
    createProgressRail();
    enableHeroParallax();
    observeTree();
  });
})();
