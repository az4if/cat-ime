/**
 * Centralized app storage + continue-watching change events.
 */
(function (global) {
  const CW_KEY = 'cw';
  const CW_MAX = 10;
  const EVENT_CW = 'catime-cw-changed';
  const MY_LIST_KEY = 'my_list';
  const EPISODE_FOLLOWS_KEY = 'episode_follows';
  const LEGACY_FOLLOWED_KEY = 'followed';

  function parseJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function normalizeAnimeId(id) {
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function normalizeIdList(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const out = [];
    raw.forEach((id) => {
      const n = normalizeAnimeId(id);
      if (n && !seen.has(n)) {
        seen.add(n);
        out.push(n);
      }
    });
    return out;
  }

  function readIdList(primaryKey, legacyKey) {
    const primary = normalizeIdList(parseJSON(primaryKey, []));
    if (primary.length) return primary;
    if (legacyKey) return normalizeIdList(parseJSON(legacyKey, []));
    return [];
  }

  function writeIdList(key, ids) {
    try {
      localStorage.setItem(key, JSON.stringify(normalizeIdList(ids)));
    } catch (err) {
      console.error('writeIdList failed:', key, err);
      throw err;
    }
  }

  function migrateLegacyFollowed() {
    const legacy = normalizeIdList(parseJSON(LEGACY_FOLLOWED_KEY, []));
    if (!legacy.length) return;
    if (!readIdList(MY_LIST_KEY, null).length) writeIdList(MY_LIST_KEY, legacy);
    if (!readIdList(EPISODE_FOLLOWS_KEY, null).length) writeIdList(EPISODE_FOLLOWS_KEY, legacy);
  }

  migrateLegacyFollowed();

  function getMyListIds() {
    return readIdList(MY_LIST_KEY, LEGACY_FOLLOWED_KEY);
  }

  function setMyListIds(ids) {
    writeIdList(MY_LIST_KEY, ids);
    writeIdList(LEGACY_FOLLOWED_KEY, ids);
  }

  function isOnMyList(id) {
    const n = normalizeAnimeId(id);
    return n ? getMyListIds().includes(n) : false;
  }

  /** My List status code only when the id is on My List; otherwise null. */
  function getMyListStatus(id) {
    const n = normalizeAnimeId(id);
    if (!n || !isOnMyList(n)) return null;
    return localStorage.getItem('stat_' + n) || 'sw';
  }

  function toggleMyListId(id) {
    const n = normalizeAnimeId(id);
    if (!n) return { onList: false, added: false };
    let ids = getMyListIds();
    const idx = ids.indexOf(n);
    if (idx > -1) {
      ids = ids.filter((x) => x !== n);
      setMyListIds(ids);
      return { onList: false, added: false };
    }
    ids.push(n);
    if (!localStorage.getItem('stat_' + n)) localStorage.setItem('stat_' + n, 'spl');
    setMyListIds(ids);
    return { onList: true, added: true };
  }

  function removeFromMyList(id) {
    const n = normalizeAnimeId(id);
    if (!n) return;
    setMyListIds(getMyListIds().filter((x) => x !== n));
  }

  function getEpisodeFollowIds() {
    // Do not fall back to `followed` / my_list — only explicit episode follows count
    return readIdList(EPISODE_FOLLOWS_KEY, null);
  }

  function setEpisodeFollowIds(ids) {
    writeIdList(EPISODE_FOLLOWS_KEY, ids);
  }

  function isEpisodeFollowed(id) {
    const n = normalizeAnimeId(id);
    return n ? getEpisodeFollowIds().includes(n) : false;
  }

  function toggleEpisodeFollowId(id) {
    const n = normalizeAnimeId(id);
    if (!n) return { following: false, added: false };
    let ids = getEpisodeFollowIds();
    const idx = ids.indexOf(n);
    if (idx > -1) {
      ids = ids.filter((x) => x !== n);
      setEpisodeFollowIds(ids);
      return { following: false, added: false };
    }
    ids.push(n);
    setEpisodeFollowIds(ids);
    return { following: true, added: true };
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

  /** @deprecated use getMyListIds */
  function getFollowed() {
    return getMyListIds();
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
    getMyListIds().slice(0, 10).forEach(add);
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
    getMyListIds,
    setMyListIds,
    isOnMyList,
    getMyListStatus,
    toggleMyListId,
    removeFromMyList,
    getEpisodeFollowIds,
    setEpisodeFollowIds,
    isEpisodeFollowed,
    toggleEpisodeFollowId,
    getFollowed,
    getMostWatchedIds,
    getRecommendationSourceIds,
    onContinueWatchingChanged,
    normalizeAnimeId,
    EVENT_CW,
    MY_LIST_KEY,
    EPISODE_FOLLOWS_KEY
  };
})(window);
