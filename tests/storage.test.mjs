import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserContext, loadScripts } from './helpers/env.mjs';

describe('CatimeStorage', () => {
  function storage() {
    const { ctx } = createBrowserContext();
    loadScripts(ctx, ['js/catime-storage.js']);
    return ctx.CatimeStorage;
  }

  it('normalizes anime ids as numbers', () => {
    const S = storage();
    assert.equal(S.normalizeAnimeId('15125'), 15125);
    assert.equal(S.normalizeAnimeId(null), null);
  });

  it('my list add/remove/toggle', () => {
    const S = storage();
    const a = S.toggleMyListId(1);
    assert.equal(a.added, true);
    assert.ok(S.isOnMyList(1));
    assert.ok(S.isOnMyList('1'));
    const b = S.toggleMyListId(1);
    assert.equal(b.added, false);
    assert.equal(S.getMyListIds().length, 0);
  });

  it('my list and episode follows are independent', () => {
    const S = storage();
    S.toggleMyListId(10);
    S.toggleEpisodeFollowId(20);
    assert.equal(JSON.stringify(S.getMyListIds()), '[10]');
    assert.equal(JSON.stringify(S.getEpisodeFollowIds()), '[20]');
  });

  it('episode follows do not inherit my_list when empty', () => {
    const S = storage();
    S.setMyListIds([99]);
    assert.equal(S.getEpisodeFollowIds().length, 0);
  });

  it('continue watching caps at 10 and updates order', () => {
    const S = storage();
    for (let i = 1; i <= 12; i++) S.updateContinueWatching(i, 1);
    const cw = S.getContinueWatching();
    assert.equal(cw.length, 10);
    assert.equal(cw[0].id, 12);
  });

  it('recommendation sources merge cw, list, and watched', () => {
    const { ctx, storage: ls } = createBrowserContext();
    ls.setItem('w_3', JSON.stringify([1, 2, 3]));
    loadScripts(ctx, ['js/catime-storage.js']);
    ctx.CatimeStorage.updateContinueWatching(1, 1);
    ctx.CatimeStorage.toggleMyListId(2);
    const ids = ctx.CatimeStorage.getRecommendationSourceIds();
    assert.ok(ids.includes(1));
    assert.ok(ids.includes(2));
    assert.ok(ids.includes(3));
  });

  it('legacy followed migrates once on load', () => {
    const { ctx, storage: ls } = createBrowserContext();
    ls.setItem('followed', JSON.stringify([5, 6]));
    loadScripts(ctx, ['js/catime-storage.js']);
    assert.equal(JSON.stringify(ctx.CatimeStorage.getMyListIds()), '[5,6]');
    assert.equal(JSON.stringify(ctx.CatimeStorage.getEpisodeFollowIds()), '[5,6]');
  });
});
