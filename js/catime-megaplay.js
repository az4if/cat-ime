/**
 * MegaPlay embeds via Anikoto episode_embed_id → /stream/s-2/
 * @see https://megaplay.buzz/api
 * @see https://anikotoapi.site/
 */
(function (global) {
  const MEGAPLAY_ORIGIN = 'https://megaplay.buzz';
  const ANIKOTO_DIRECT = 'https://anikotoapi.site';
  const MAP_KEY = 'anikoto_catalog_map_v1';
  const SERIES_CACHE_PREFIX = 'anikoto_series_v1_';
  const URL_CACHE_PREFIX = 'megaplay_url_v2_';
  const PARALLEL_PAGES = 5;

  /** @type {Map<string, Promise<number|null>>} */
  const catalogReady = new Map();

  function getSupabaseConfig() {
    return global.supabaseConfig || global.window?.supabaseConfig || null;
  }

  /** Anikoto has no CORS — use local /api/anikoto (npm start) or Supabase edge proxy on live site. */
  function getAnikotoTransport() {
    if (typeof location === 'undefined') {
      return { mode: 'direct', base: ANIKOTO_DIRECT };
    }
    if (location.protocol === 'file:') {
      return { mode: 'none' };
    }
    const host = location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return { mode: 'local', base: `${location.origin}/api/anikoto` };
    }
    const cfg = getSupabaseConfig();
    if (cfg?.url && cfg?.anonKey) {
      return {
        mode: 'supabase',
        base: `${cfg.url.replace(/\/$/, '')}/functions/v1/anikoto-proxy`,
        anonKey: cfg.anonKey,
      };
    }
    return { mode: 'none' };
  }

  function getAnikotoApiBase() {
    const t = getAnikotoTransport();
    if (t.mode === 'local') return t.base;
    if (t.mode === 'supabase') return t.base;
    if (t.mode === 'direct') return t.base;
    return null;
  }

  async function anikotoFetch(pathWithQuery) {
    const transport = getAnikotoTransport();
    if (transport.mode === 'none') {
      const err = new Error('OPEN_VIA_HTTP');
      err.code = 'OPEN_VIA_HTTP';
      throw err;
    }
    if (transport.mode === 'local') {
      return fetch(`${transport.base}${pathWithQuery}`);
    }
    if (transport.mode === 'supabase') {
      const url = `${transport.base}?path=${encodeURIComponent(pathWithQuery)}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${transport.anonKey}`,
          apikey: transport.anonKey,
        },
      });
      if (res.status === 404) {
        const err = new Error('PROXY_NOT_DEPLOYED');
        err.code = 'PROXY_NOT_DEPLOYED';
        throw err;
      }
      return res;
    }
    return fetch(`${ANIKOTO_DIRECT}${pathWithQuery}`);
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
      console.warn('Anikoto cache save failed:', e);
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
    const res = await anikotoFetch(`/recent-anime?page=${page}&per_page=${perPage}`);
    if (!res.ok) throw new Error(`Anikoto HTTP ${res.status}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Anikoto error');
    return json;
  }

  async function findAnikotoCatalogId(storage, anilistId, malId, options) {
    const maxSearchPages = options?.maxSearchPages ?? 60;
    const parallelPages = options?.parallelPages ?? PARALLEL_PAGES;
    let map = loadCatalogMap(storage);
    let hit = catalogIdFromMap(map, anilistId, malId);
    if (hit) return hit;

    let totalPages = maxSearchPages;
    for (let start = 1; start <= maxSearchPages; start += parallelPages) {
      const end = Math.min(start + parallelPages - 1, maxSearchPages);
      const pageNums = [];
      for (let p = start; p <= end; p++) pageNums.push(p);

      const results = await Promise.allSettled(
        pageNums.map((p) => fetchAnikotoRecent(p, 50))
      );

      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        ingestRecentPage(map, r.value.data);
        totalPages = r.value.pagination?.total_pages ?? totalPages;
      }
      saveCatalogMap(storage, map);
      hit = catalogIdFromMap(map, anilistId, malId);
      if (hit) return hit;
      if (start >= totalPages) break;
    }
    return null;
  }

  function isUnplayableStreamUrl(url) {
    return typeof url !== 'string' || !url || url.includes('/stream/ani/');
  }

  function urlFromSeriesEpisode(ep, audio) {
    if (!ep) return null;
    const primary = audio === 'dub' ? ep.dub : ep.sub;
    const alternate = audio === 'dub' ? ep.sub : ep.dub;
    if (primary) return primary;
    if (alternate) return alternate;
    if (ep.embedId) {
      const track = ep.dub && !ep.sub ? 'dub' : ep.sub && !ep.dub ? 'sub' : audio;
      return `${MEGAPLAY_ORIGIN}/stream/s-2/${ep.embedId}/${track}`;
    }
    return null;
  }

  function purgeStaleUrlCache(storage) {
    if (!storage) return;
    const keys = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && (k.startsWith(URL_CACHE_PREFIX) || k.startsWith('megaplay_url_'))) {
        keys.push(k);
      }
    }
    for (const k of keys) {
      if (isUnplayableStreamUrl(storage.getItem(k))) storage.removeItem(k);
    }
  }

  async function fetchAndCacheSeries(storage, catalogId) {
    const key = SERIES_CACHE_PREFIX + catalogId;
    const cached = readJson(storage, key, null);
    if (cached?.episodes) return cached.episodes;

    let res;
    try {
      res = await anikotoFetch(`/series/${catalogId}`);
    } catch {
      return null;
    }
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.ok || !json.data?.episodes) return null;

    const episodes = {};
    for (const row of json.data.episodes) {
      const n = String(row.number);
      episodes[n] = {
        embedId: row.episode_embed_id || null,
        sub: row.embed_url?.sub || null,
        dub: row.embed_url?.dub || null,
      };
    }
    writeJson(storage, key, { episodes });
    return episodes;
  }

  async function findAndWarmSeries(storage, anilistId, malId, options) {
    const map = loadCatalogMap(storage);
    let catalogId = catalogIdFromMap(map, anilistId, malId);
    if (!catalogId) {
      catalogId = await findAnikotoCatalogId(storage, anilistId, malId, options);
    }
    if (catalogId) await fetchAndCacheSeries(storage, catalogId);
    return catalogId;
  }

  function catalogReadyKey(anilistId, malId) {
    return `${anilistId}:${malId ?? ''}`;
  }

  function ensureCatalogReady(anilistId, malId, options) {
    const key = catalogReadyKey(anilistId, malId);
    if (!catalogReady.has(key)) {
      const storage = global.localStorage;
      const work = findAndWarmSeries(storage, anilistId, malId, options).finally(() => {
        catalogReady.delete(key);
      });
      catalogReady.set(key, work);
    }
    return catalogReady.get(key);
  }

  function prefetchForAnime(anilistId, malId) {
    return ensureCatalogReady(anilistId, malId);
  }

  async function fetchEpisodeEmbedId(catalogId, epNum) {
    const storage = global.localStorage;
    const episodes = await fetchAndCacheSeries(storage, catalogId);
    if (!episodes) return null;
    return episodes[String(epNum)]?.embedId || null;
  }

  function buildStreamUrl(embedId, anilistId, epNum, audio) {
    if (embedId) {
      return `${MEGAPLAY_ORIGIN}/stream/s-2/${embedId}/${audio}`;
    }
    return null;
  }

  async function resolveStreamUrl(anilistId, epNum, audio, malId) {
    const storage = global.localStorage;
    purgeStaleUrlCache(storage);

    const cacheKey = `${URL_CACHE_PREFIX}${anilistId}_${epNum}_${audio}`;
    const cached = storage.getItem(cacheKey);
    if (cached && !isUnplayableStreamUrl(cached)) return cached;

    const catalogId = await ensureCatalogReady(anilistId, malId);
    if (catalogId) {
      const episodes = readJson(storage, SERIES_CACHE_PREFIX + catalogId, null)?.episodes
        || (await fetchAndCacheSeries(storage, catalogId));
      const url = urlFromSeriesEpisode(episodes?.[String(epNum)], audio);
      if (url && !isUnplayableStreamUrl(url)) {
        try {
          storage.setItem(cacheKey, url);
        } catch (_) { /* quota */ }
        return url;
      }
    }

    return null;
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
    getAnikotoTransport,
    anikotoFetch,
    resolveStreamUrl,
    buildStreamUrl,
    isUnplayableStreamUrl,
    findAnikotoCatalogId,
    prefetchForAnime,
    fetchAndCacheSeries,
    urlFromSeriesEpisode,
    purgeStaleUrlCache,
    startBackgroundIndex,
    isCompleteEvent,
  };
})(typeof window !== 'undefined' ? window : globalThis);
