import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserContext, loadScripts } from './helpers/env.mjs';

describe('CatimeApi', () => {
  function api() {
    const { ctx } = createBrowserContext();
    loadScripts(ctx, ['js/catime-api.js']);
    return ctx.CatimeApi;
  }

  it('buildCacheKey is stable for same query', () => {
    const A = api();
    const q = 'query { Media(id: 1) { id } }';
    const k1 = A.buildCacheKey(q, { id: 1 });
    const k2 = A.buildCacheKey(q, { id: 1 });
    assert.equal(k1, k2);
    assert.ok(k1.startsWith(A.CACHE_PREFIX));
  });

  it('shouldUseCache skips recommendations and large id_in', () => {
    const A = api();
    assert.equal(A.shouldUseCache('query { recommendations { ... } }', {}), false);
    assert.equal(A.shouldUseCache('query', { ids: Array.from({ length: 20 }, (_, i) => i) }), false);
    assert.equal(A.shouldUseCache('query', { ids: [1, 2, 3] }), true);
  });

  it('readCache expires old entries', () => {
    const { ctx } = createBrowserContext();
    loadScripts(ctx, ['js/catime-api.js']);
    const key = ctx.CatimeApi.buildCacheKey('q', {});
    ctx.localStorage.setItem(key, JSON.stringify({ ts: Date.now() - 99999999, data: { x: 1 } }));
    assert.equal(ctx.CatimeApi.readCache(key, 1000), null);
  });

  it('writeCache skips oversized payloads', () => {
    const { ctx } = createBrowserContext();
    loadScripts(ctx, ['js/catime-api.js']);
    const key = ctx.CatimeApi.buildCacheKey('big', {});
    const big = { data: 'x'.repeat(ctx.CatimeApi.MAX_CACHE_ENTRY_BYTES) };
    ctx.CatimeApi.writeCache(key, big);
    assert.equal(ctx.localStorage.getItem(key), null);
  });

  it('fetchGraphQL uses cache on second call', async () => {
    let fetches = 0;
    const { ctx } = createBrowserContext({
      fetch: async () => {
        fetches++;
        return { ok: true, json: async () => ({ data: { Media: { id: 1 } } }) };
      }
    });
    loadScripts(ctx, ['js/catime-api.js']);
    const q = 'query { Media(id: 1) { id } }';
    await ctx.CatimeApi.fetchGraphQL(q, { id: 1 });
    await ctx.CatimeApi.fetchGraphQL(q, { id: 1 });
    assert.equal(fetches, 1);
  });
});
