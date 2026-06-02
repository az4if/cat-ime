import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatimeStack } from './helpers/env.mjs';

describe('CatimeFeatures', () => {
  it('ratings save and clear', () => {
    const { CatimeFeatures: F } = loadCatimeStack();
    F.saveDetailRating(42, '9');
    assert.equal(F.getRatings()[42], 9);
    F.saveDetailRating(42, '');
    assert.equal(F.getRatings()[42], undefined);
  });

  it('watch queue add, dedupe, limit behavior', () => {
    const { CatimeFeatures: F } = loadCatimeStack();
    const anime = { id: 1, malId: 1, title: 'A', eps: 12, img: '' };
    F.addToQueue(anime);
    F.addToQueue(anime);
    assert.equal(F.getQueue().length, 1);
    F.addToQueue({ id: 2, title: 'B', eps: 1, img: '' });
    assert.equal(F.getQueue().length, 2);
    F.removeFromQueue(1);
    assert.equal(F.getQueue().length, 1);
  });

  it('updateRoute sets watch URL params', () => {
    const { ctx, CatimeFeatures: F } = loadCatimeStack();
    let saved = '';
    ctx.history.replaceState = (_, __, url) => { saved = String(url); };
    F.updateRoute('watch', 99, 3, 'dub');
    assert.match(saved, /page=watch/);
    assert.match(saved, /anime=99/);
    assert.match(saved, /ep=3/);
    assert.match(saved, /audio=dub/);
  });

  it('bulkMarkWatched marks episodes up to current', () => {
    const { ctx, CatimeFeatures: F } = loadCatimeStack();
    ctx.curAnime = { id: 50, eps: 5 };
    ctx.curEp = 3;
    F.bulkMarkWatched('toCurrent');
    const raw = ctx.localStorage.getItem('w_50');
    const eps = JSON.parse(raw);
    assert.deepEqual(eps.sort((a, b) => a - b), [1, 2, 3]);
  });

  it('shareAnime builds clipboard url', async () => {
    const { ctx, CatimeFeatures: F } = loadCatimeStack();
    let copied = '';
    ctx.navigator.clipboard = {
      writeText: (u) => { copied = u; return Promise.resolve(); }
    };
    F.shareAnime(55, 2, 'sub');
    await new Promise((r) => setTimeout(r, 0));
    assert.match(copied, /anime=55/);
    assert.match(copied, /ep=2/);
  });
});
