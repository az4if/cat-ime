/**
 * Centralized app storage + continue-watching change events.
 */
(function (global) {
  const CW_KEY = 'cw';
  const CW_MAX = 10;
  const EVENT_CW = 'catime-cw-changed';
  const PROG_PREFIX = 'epprog_';
  const PROG_MIN_SEC = 15;
  const PROG_MAX_SEC = 14400;

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

  function episodeProgressKey(id, ep) {
    return `${PROG_PREFIX}${Number(id)}_${Number(ep)}`;
  }

  function getEpisodeProgress(id, ep) {
    const raw = localStorage.getItem(episodeProgressKey(id, ep));
    const n = Number(raw);
    if (!Number.isFinite(n) || n < PROG_MIN_SEC) return 0;
    return Math.min(Math.floor(n), PROG_MAX_SEC);
  }

  function setEpisodeProgress(id, ep, seconds) {
    const key = episodeProgressKey(id, ep);
    const s = Math.min(Math.floor(Number(seconds) || 0), PROG_MAX_SEC);
    if (s < PROG_MIN_SEC) {
      localStorage.removeItem(key);
      return 0;
    }
    localStorage.setItem(key, String(s));
    return s;
  }

  function clearEpisodeProgress(id, ep) {
    localStorage.removeItem(episodeProgressKey(id, ep));
  }

  function clearAllEpisodeProgressForAnime(id) {
    const prefix = `${PROG_PREFIX}${Number(id)}_`;
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) toRemove.push(key);
    }
    toRemove.forEach((key) => localStorage.removeItem(key));
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

  global.CatimeStorage = {
    getContinueWatching,
    setContinueWatching,
    updateContinueWatching,
    removeFromContinueWatching,
    getEpisodeProgress,
    setEpisodeProgress,
    clearEpisodeProgress,
    clearAllEpisodeProgressForAnime,
    clearContinueWatching,
    PROG_PREFIX,
    PROG_MIN_SEC,
    PROG_MAX_SEC,
    getFollowed,
    getMostWatchedIds,
    getRecommendationSourceIds,
    onContinueWatchingChanged,
    EVENT_CW
  };
})(window);
