import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserContext, loadScripts } from './helpers/env.mjs';

describe('CatimeMegaplay', () => {
  function megaplay() {
    const { ctx, storage } = createBrowserContext();
    loadScripts(ctx, ['js/catime-megaplay.js']);
    return { M: ctx.CatimeMegaplay, storage };
  }

  it('builds s-2 URL when embed id is known', () => {
    const { M } = megaplay();
    assert.equal(
      M.buildStreamUrl('136197', 21, 1, 'dub'),
      'https://megaplay.buzz/stream/s-2/136197/dub'
    );
  });

  it('maps anilist id via cached Anikoto catalog', async () => {
    const { M, storage } = megaplay();
    storage.setItem('anikoto_catalog_map_v1', JSON.stringify({ byAnilist: { 21: 1642 }, byMal: {} }));
    const id = await M.findAnikotoCatalogId(storage, 21, null, { maxSearchPages: 0 });
    assert.equal(id, 1642);
  });
});
