/**
 * Centralized app storage + continue-watching change events.
 */
(function (global) {
  const CW_KEY = 'cw';
  const CW_MAX = 10;
  const EVENT_CW = 'catime-cw-changed';

  function parseJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function getContinueWatching() {
    return parseJSON(CW_KEY, []);
  }

  function notifyCW() {
    document.dispatchEvent(new CustomEvent(EVENT_CW));
  }

  function setContinueWatching(list) {
    const next = Array.isArray(list) ? list.slice(0, CW_MAX) : [];
    localStorage.setItem(CW_KEY, JSON.stringify(next));
    notifyCW();
    return next;
  }

  function updateContinueWatching(id, ep) {
    const numId = Number(id);
    const numEp = Number(ep);
    const cw = getContinueWatching().filter(x => x.id !== numId);
    cw.unshift({ id: numId, ep: numEp, ts: Date.now() });
    return setContinueWatching(cw);
  }

  function removeFromContinueWatching(id) {
    return setContinueWatching(getContinueWatching().filter(c => c.id !== Number(id)));
  }

  function clearContinueWatching() {
    localStorage.removeItem(CW_KEY);
    notifyCW();
  }

  function getFollowed() {
    return parseJSON('followed', []);
  }

  function getMostWatchedIds(limit = 5) {
    const scored = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('w_')) continue;
      const id = Number(key.slice(2));
      if (!id) continue;
      const eps = parseJSON(key, []);
      if (Array.isArray(eps) && eps.length) scored.push({ id, count: eps.length });
    }
    return scored.sort((a, b) => b.count - a.count).slice(0, limit).map(x => x.id);
  }

  function getRecommendationSourceIds() {
    const seen = new Set();
    const ids = [];
    const add = (id) => {
      const n = Number(id);
      if (!n || seen.has(n)) return;
      seen.add(n);
      ids.push(n);
    };
    getContinueWatching().slice(0, 10).forEach(x => add(x.id));
    getFollowed().slice(0, 10).forEach(add);
    getMostWatchedIds(5).forEach(add);
    return ids.slice(0, 15);
  }

  function onContinueWatchingChanged(fn) {
    document.addEventListener(EVENT_CW, fn);
  }

  function clearLegacyEpisodeProgress() {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('epprog_')) toRemove.push(key);
    }
    toRemove.forEach((key) => localStorage.removeItem(key));
  }

  clearLegacyEpisodeProgress();

  global.CatimeStorage = {
    getContinueWatching,
    setContinueWatching,
    updateContinueWatching,
    removeFromContinueWatching,
    clearContinueWatching,
    getFollowed,
    getMostWatchedIds,
    getRecommendationSourceIds,
    onContinueWatchingChanged,
    EVENT_CW
  };
})(window);
