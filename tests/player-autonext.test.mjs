import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ROOT } from './helpers/env.mjs';

describe('player auto-next + watched (static)', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

  const autoNextBlock = (() => {
    const start = html.indexOf('function triggerPlayerAutoNext');
    assert.ok(start > 0, 'triggerPlayerAutoNext missing');
    return html.slice(start, start + 1200);
  })();

  it('defaults pref_autonext to on for new users', () => {
    assert.match(html, /if \(localStorage\.getItem\('pref_autonext'\) === null\)/);
    assert.match(html, /localStorage\.setItem\('pref_autonext', 'true'\)/);
    assert.match(html, /if \(key === 'autonext'\) return v === null \|\| v === 'true'/);
  });

  it('marks ending episode watched before advancing', () => {
    assert.match(autoNextBlock, /markWatched\(curAnime\.id, endingEp\)/);
    assert.match(autoNextBlock, /applyWatchedEpUi\(curAnime\.id, endingEp\)/);
    assert.match(autoNextBlock, /goNextEpisode\(\)/);
    const markIdx = autoNextBlock.indexOf('markWatched');
    const nextIdx = autoNextBlock.indexOf('goNextEpisode');
    assert.ok(markIdx >= 0 && nextIdx > markIdx, 'markWatched must run before goNextEpisode');
  });

  it('listens for player end events from embed origins', () => {
    assert.match(html, /installPlayerEmbedMessageBridge/);
    assert.match(html, /PLAYER_EMBED_ORIGINS/);
    assert.match(html, /CatimeMegaplay\?\.isCompleteEvent/);
    assert.match(html, /triggerPlayerAutoNext\(data\.episode/);
  });

  it('resolves megaplay via CatimeMegaplay (not animeplay wrapper)', () => {
    assert.match(html, /js\/catime-megaplay\.js/);
    assert.match(html, /CatimeMegaplay\.resolveStreamUrl/);
    assert.doesNotMatch(html, /animeplay\.cfd\/stream\/ani/);
  });

  it('megaplay source supports autonext cap', () => {
    assert.match(html, /megaplay:\s*\{\s*autoplay:\s*false,\s*autonext:\s*true\s*\}/);
  });

  it('exposes auto-next controls on watch page and settings', () => {
    assert.match(html, /id="watchAutonextBtn"/);
    assert.match(html, /id="spAutonext"/);
    assert.match(html, /togglePlayerPref\('autonext'\)/);
  });

  it('exposes triggerPlayerAutoNext for manual browser checks', () => {
    assert.match(html, /window\.triggerPlayerAutoNext = triggerPlayerAutoNext/);
  });
});
