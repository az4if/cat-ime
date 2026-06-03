/**
 * MegaPlay embeds via Anikoto episode_embed_id → /stream/s-2/
 * @see https://megaplay.buzz/api
 * @see https://anikotoapi.site/
 */
(function (global) {
  const MEGAPLAY_ORIGIN = 'https://megaplay.buzz';
  const ANIKOTO_DIRECT = 'https://anikotoapi.site';
  const MAP_KEY = 'anikoto_catalog_map_v1';
  const URL_CACHE_PREFIX = 'megaplay_url_';

  /** Anikoto has no Access-Control-Allow-Origin; use same-origin /api/anikoto proxy (npm start). */
  function getAnikotoApiBase() {
    if (typeof location === 'undefined') return ANIKOTO_DIRECT;
    if (location.protocol === 'file:') return null;
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      return `${location.origin}/api/anikoto`;
    }
    return ANIKOTO_DIRECT;
  }

  function readJson(storage, key, fallback) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Anikoto map save failed:', e);
    }
  }

  function loadCatalogMap(storage) {
    return readJson(storage, MAP_KEY, { byAnilist: {}, byMal: {} });
  }

  function saveCatalogMap(storage, map) {
    writeJson(storage, MAP_KEY, map);
  }

  function catalogIdFromMap(map, anilistId, malId) {
    const a = map.byAnilist[String(anilistId)];
    if (a) return a;
    if (malId != null && malId !== '') {
      const m = map.byMal[String(malId)];
      if (m) return m;
    }
    return null;
  }

  function ingestRecentPage(map, items) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item || item.id == null) continue;
      if (item.ani_id != null && item.ani_id !== '') {
        map.byAnilist[String(item.ani_id)] = item.id;
      }
      if (item.mal_id != null && item.mal_id !== '') {
        map.byMal[String(item.mal_id)] = item.id;
      }
    }
  }

  async function fetchAnikotoRecent(page, perPage) {
    const base = getAnikotoApiBase();
    if (!base) {
      const err = new Error('OPEN_VIA_HTTP');
      err.code = 'OPEN_VIA_HTTP';
      throw err;
    }
    const url = `${base}/recent-anime?page=${page}&per_page=${perPage}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Anikoto HTTP ${res.status}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Anikoto error');
    return json;
  }

  async function findAnikotoCatalogId(storage, anilistId, malId, options) {
    const maxSearchPages = options?.maxSearchPages ?? 80;
    let map = loadCatalogMap(storage);
    let hit = catalogIdFromMap(map, anilistId, malId);
    if (hit) return hit;

    for (let page = 1; page <= maxSearchPages; page++) {
      try {
        const json = await fetchAnikotoRecent(page, 50);
        ingestRecentPage(map, json.data);
        saveCatalogMap(storage, map);
        hit = catalogIdFromMap(map, anilistId, malId);
        if (hit) return hit;
        const totalPages = json.pagination?.total_pages || page;
        if (page >= totalPages) break;
      } catch (e) {
        console.warn('Anikoto catalog search failed:', e);
        break;
      }
    }
    return null;
  }

  async function fetchEpisodeEmbedId(catalogId, epNum) {
    const base = getAnikotoApiBase();
    if (!base) return null;
    const res = await fetch(`${base}/series/${catalogId}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.ok || !json.data?.episodes) return null;
    const ep = json.data.episodes.find((e) => Number(e.number) === Number(epNum));
    return ep?.episode_embed_id || null;
  }

  function buildStreamUrl(embedId, anilistId, epNum, audio) {
    if (embedId) {
      return `${MEGAPLAY_ORIGIN}/stream/s-2/${embedId}/${audio}`;
    }
    return `${MEGAPLAY_ORIGIN}/stream/ani/${anilistId}/${epNum}/${audio}`;
  }

  async function resolveStreamUrl(anilistId, epNum, audio, malId) {
    const storage = global.localStorage;
    const cacheKey = `${URL_CACHE_PREFIX}${anilistId}_${epNum}_${audio}`;
    const cached = storage.getItem(cacheKey);
    if (cached) return cached;

    const catalogId = await findAnikotoCatalogId(storage, anilistId, malId);
    let embedId = null;
    if (catalogId) {
      embedId = await fetchEpisodeEmbedId(catalogId, epNum);
    }

    const url = buildStreamUrl(embedId, anilistId, epNum, audio);
    try {
      storage.setItem(cacheKey, url);
    } catch (_) { /* quota */ }
    return url;
  }

  function startBackgroundIndex(storage, scheduleFn) {
    const run = scheduleFn || ((fn, ms) => setTimeout(fn, ms));
    const map = loadCatalogMap(storage);
    const lastPage = Number(storage.getItem('anikoto_index_page') || 0);
    const next = lastPage + 1;
    run(async () => {
      try {
        const json = await fetchAnikotoRecent(next, 50);
        ingestRecentPage(map, json.data);
        saveCatalogMap(storage, map);
        storage.setItem('anikoto_index_page', String(next));
        if (next < (json.pagination?.total_pages || next)) {
          startBackgroundIndex(storage, scheduleFn);
        }
      } catch (e) {
        console.warn('Anikoto background index:', e);
      }
    }, 2500);
  }

  function isCompleteEvent(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.event === 'complete') return true;
    if (data.type === 'episode-ended' || data.type === 'ended') return true;
    if (data.channel === 'megacloud' && data.event === 'complete') return true;
    if (data.type === 'PLAYER_EVENT' && data.data) {
      const ev = data.data.event;
      return ev === 'ended' || ev === 'complete';
    }
    return false;
  }

  global.CatimeMegaplay = {
    MEGAPLAY_ORIGIN,
    getAnikotoApiBase,
    resolveStreamUrl,
    buildStreamUrl,
    findAnikotoCatalogId,
    startBackgroundIndex,
    isCompleteEvent,
  };
})(typeof window !== 'undefined' ? window : globalThis);
