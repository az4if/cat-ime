import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ROOT } from './helpers/env.mjs';

describe('index.html sanity', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

  it('loads core script modules in order', () => {
    const storage = html.indexOf('js/catime-storage.js');
    const appData = html.indexOf('js/catime-app-data.js');
    const megaplay = html.indexOf('js/catime-megaplay.js');
    const features = html.indexOf('js/catime-features.js');
    assert.ok(storage > 0 && appData > storage && megaplay > appData && features > megaplay);
  });

  it('exposes list and follow controls on watch page', () => {
    assert.match(html, /id="btnMyList"/);
    assert.match(html, /id="btnFollow"/);
    assert.match(html, /CatimeFeatures\.toggleMyList/);
    assert.match(html, /CatimeFeatures\.toggleEpisodeFollow/);
  });

  it('wires export/import backup to app data helpers', () => {
    assert.match(html, /exportAppBackup/);
    assert.match(html, /importAppBackup/);
    assert.match(html, /CatimeAppData/);
  });

  it('shows truncated hero synopsis with score fallback', () => {
    assert.match(html, /function getHeroSubtitle/);
    assert.match(html, /function truncateHeroDescription/);
    assert.match(html, /sub\.textContent = subtitle \|\| 'Trending now\.'/);
  });
});
