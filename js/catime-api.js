/**
 * Cached AniList GraphQL fetch helper.
 */
(function (global) {
  const CACHE_PREFIX = 'catime_api_';
  const DEFAULT_TTL_MS = 15 * 60 * 1000;

  function buildCacheKey(query, variables) {
    return CACHE_PREFIX + JSON.stringify({ query, variables });
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
    try {
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
    } catch (err) {
      console.warn('API cache write failed:', err);
    }
  }

  async function fetchGraphQL(query, variables = {}, options = {}) {
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    const useCache = options.useCache !== false;
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

  global.CatimeApi = { fetchGraphQL, DEFAULT_TTL_MS };
})(window);
