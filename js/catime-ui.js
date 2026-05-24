/**
 * Shared UI helpers: skeletons, section states, keyboard shortcuts.
 */
(function (global) {
  function renderSkeletonScroll(containerId, count = 6) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const sk = document.createElement('div');
      sk.className = 'skeleton-card';
      sk.setAttribute('aria-hidden', 'true');
      el.appendChild(sk);
    }
  }

  function setStatus(statusId, message) {
    const el = document.getElementById(statusId);
    if (el) el.textContent = message || '';
  }

  function showSectionError(containerId, statusId, message, retryFn) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'section-state';
    const p = document.createElement('p');
    p.textContent = message;
    wrap.appendChild(p);
    if (typeof retryFn === 'function') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'section-retry-btn';
      btn.textContent = 'Retry';
      btn.addEventListener('click', retryFn);
      wrap.appendChild(btn);
    }
    el.appendChild(wrap);
    if (statusId) setStatus(statusId, '');
  }

  function showSectionEmpty(containerId, statusId, message) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `<div class="section-state section-state--empty"><p>${message}</p></div>`;
    if (statusId) setStatus(statusId, '');
  }

  function initKeyboardShortcuts(handlers) {
    const h = handlers || {};
    document.addEventListener('keydown', (e) => {
      const target = e.target;
      const tag = target && target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;

      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (h.goPage) h.goPage('search');
        const inp = document.getElementById('searchInput');
        if (inp) setTimeout(() => inp.focus(), 0);
        return;
      }

      if (e.key === 'Escape') {
        if (h.closeDetailDrawer) h.closeDetailDrawer();
        if (h.hideAccountSettings) h.hideAccountSettings();
        if (h.hideAccountModal) h.hideAccountModal();
        document.getElementById('npPanel')?.classList.remove('open');
        document.getElementById('spPanel')?.classList.remove('open');
        document.getElementById('customThemePanel')?.classList.remove('open');
        return;
      }

      const watchActive = document.getElementById('page-watch')?.classList.contains('active');
      if (watchActive && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if ((e.key === 'n' || e.key === 'N') && h.goNextEpisode) {
          e.preventDefault();
          h.goNextEpisode();
          return;
        }
        if ((e.key === 'j' || e.key === 'J') && h.goPrevEpisode) {
          e.preventDefault();
          h.goPrevEpisode();
          return;
        }
        if ((e.key === 'k' || e.key === 'K') && h.goNextEpisode) {
          e.preventDefault();
          h.goNextEpisode();
          return;
        }
        if ((e.key === 's' || e.key === 'S') && h.toggleDS) {
          e.preventDefault();
          h.toggleDS();
          return;
        }
        if ((e.key === 'r' || e.key === 'R') && h.rotateSource) {
          e.preventDefault();
          h.rotateSource();
          return;
        }
      }
    });
  }

  global.CatimeUI = {
    renderSkeletonScroll,
    setStatus,
    showSectionError,
    showSectionEmpty,
    initKeyboardShortcuts
  };
})(window);
