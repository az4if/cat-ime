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
    assert.equal(M.buildStreamUrl(null, 21, 1, 'sub'), null);
  });

  it('flags ani URLs as unplayable', () => {
    const { M } = megaplay();
    assert.ok(M.isUnplayableStreamUrl('https://megaplay.buzz/stream/ani/1/1/sub'));
    assert.ok(!M.isUnplayableStreamUrl('https://megaplay.buzz/stream/s-2/1/sub'));
  });

  it('maps anilist id via cached Anikoto catalog', async () => {
    const { M, storage } = megaplay();
    storage.setItem('anikoto_catalog_map_v1', JSON.stringify({ byAnilist: { 21: 1642 }, byMal: {} }));
    const id = await M.findAnikotoCatalogId(storage, 21, null, { maxSearchPages: 0 });
    assert.equal(id, 1642);
  });

  it('uses cached series embed URLs without rebuilding ani path', async () => {
    const { M, storage } = megaplay();
    storage.setItem('anikoto_catalog_map_v1', JSON.stringify({ byAnilist: { 21: 1642 }, byMal: {} }));
    storage.setItem(
      'anikoto_series_v1_1642',
      JSON.stringify({
        episodes: {
          1: { sub: 'https://megaplay.buzz/stream/s-2/2142/sub', dub: null, embedId: '2142' },
        },
      })
    );
    const url = await M.resolveStreamUrl(21, 1, 'sub', null);
    assert.equal(url, 'https://megaplay.buzz/stream/s-2/2142/sub');
  });
});
