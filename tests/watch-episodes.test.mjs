import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ROOT } from './helpers/env.mjs';

describe('watch episode list (static)', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const megaplay = readFileSync(join(ROOT, 'js/catime-megaplay.js'), 'utf8');

  it('caps list to aired episodes and shows upcoming row', () => {
    assert.match(html, /resolveWatchEpisodeMeta/);
    assert.match(html, /getAiredEpisodeMax/);
    assert.match(html, /epi upcoming/);
    assert.match(html, /nextUpcoming/);
    assert.match(html, /Coming soon/);
  });

  it('grays out unavailable SUB/DUB per episode', () => {
    assert.match(html, /applyStreamAvailabilityFromSeries/);
    assert.match(html, /getEpisodeStreamAvailability/);
    assert.match(html, /db2\.disabled/);
    assert.match(html, /DUB is not available for this episode/);
    assert.match(megaplay, /hasSub: Boolean/);
    assert.match(megaplay, /hasDub: Boolean/);
    assert.match(megaplay, /getSeriesEpisodesMap/);
  });

  it('does not load player for unaired episode numbers', () => {
    assert.match(html, /epNum > airedMax/);
    assert.match(html, /This episode has not aired yet/);
  });

  it('auto-next respects aired cap', () => {
    const block = html.slice(html.indexOf('function goNextEpisode'), html.indexOf('function goNextEpisode') + 400);
    assert.match(block, /getAiredEpisodeMax/);
    assert.match(block, /curEp >= airedMax/);
  });
});
