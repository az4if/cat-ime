/**
 * Cached AniList GraphQL fetch helper.
 */
(function (global) {
  const CACHE_PREFIX = 'catime_api_';
  const DEFAULT_TTL_MS = 15 * 60 * 1000;
  const MAX_CACHE_ENTRIES = 48;
  const MAX_CACHE_ENTRY_BYTES = 100 * 1024;

  function buildCacheKey(query, variables) {
    return CACHE_PREFIX + JSON.stringify({ query, variables });
  }

  function shouldUseCache(query, variables) {
    if (/\brecommendations\b/i.test(query)) return false;
    // Bulk id_in queries (e.g. recommendations) are large; single-id and CW (≤10) stay cacheable.
    const ids = variables?.ids;
    if (Array.isArray(ids) && ids.length > 12) return false;
    return true;
  }

  function listCacheKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    return keys;
  }

  function pruneCache() {
    try {
      const now = Date.now();
      const entries = [];

      listCacheKeys().forEach((k) => {
        try {
          const raw = localStorage.getItem(k);
          if (!raw) return;
          const parsed = JSON.parse(raw);
          if (!parsed || now - parsed.ts > DEFAULT_TTL_MS) {
            localStorage.removeItem(k);
            return;
          }
          entries.push({ k, ts: parsed.ts, size: raw.length });
        } catch {
          localStorage.removeItem(k);
        }
      });

      entries.sort((a, b) => a.ts - b.ts);
      while (entries.length > MAX_CACHE_ENTRIES) {
        localStorage.removeItem(entries.shift().k);
      }

      if (entries.reduce((sum, e) => sum + e.size, 0) > 4 * 1024 * 1024) {
        entries.sort((a, b) => b.size - a.size);
        entries.slice(0, Math.ceil(entries.length / 3)).forEach((e) => {
          localStorage.removeItem(e.k);
        });
      }
    } catch (err) {
      console.warn('API cache prune failed:', err);
    }
  }

  function readCache(key, ttlMs) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || Date.now() - parsed.ts > ttlMs) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed.data;
    } catch {
      return null;
    }
  }

  function writeCache(key, data) {
    const payload = JSON.stringify({ ts: Date.now(), data });
    if (payload.length > MAX_CACHE_ENTRY_BYTES) return;

    try {
      localStorage.setItem(key, payload);
    } catch (err) {
      if (err?.name !== 'QuotaExceededError') {
        console.warn('API cache write failed:', err);
        return;
      }
      pruneCache();
      try {
        localStorage.setItem(key, payload);
      } catch {
        // Storage full — skip cache; fetch still succeeded.
      }
    }
  }

  async function fetchGraphQL(query, variables = {}, options = {}) {
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    const useCache = options.useCache !== false && shouldUseCache(query, variables);
    const key = buildCacheKey(query, variables);

    if (useCache) {
      const cached = readCache(key, ttlMs);
      if (cached) return cached;
    }

    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });

    const data = await res.json();
    if (useCache && data?.data) writeCache(key, data);
    return data;
  }

  global.CatimeApi = { fetchGraphQL, DEFAULT_TTL_MS, pruneCache };

  // Clear expired / oversized legacy cache entries on load.
  pruneCache();
})(window);
