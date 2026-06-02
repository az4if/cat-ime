import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ROOT } from './helpers/env.mjs';

describe('load performance guards', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

  it('uses light list queries without inline description by default', () => {
    const fetchBlock = html.slice(html.indexOf('async function fetchAnilistPage'), html.indexOf('async function searchAnilist'));
    assert.match(fetchBlock, /const descField = includeDescription/);
    assert.match(fetchBlock, /popularity\$\{descField\}/);
    assert.doesNotMatch(fetchBlock, /popularity\n\s+description\(asHtml: false\)/);
  });

  it('lazy-loads lower-priority home sections', () => {
    assert.match(html, /function initHomeLazySections/);
    assert.match(html, /function bootstrapHomeFeeds/);
    assert.match(html, /bootstrapHomeFeeds\(\)/);
    assert.doesNotMatch(
      html.slice(html.indexOf('function bootstrapHomeFeeds')),
      /loadTopRated\(\);\s*loadMostPopular\(\)/
    );
  });

  it('defers heavy watch-page fetches', () => {
    assert.match(html, /scheduleIdleTask\(\(\) => \{[\s\S]*fetchSeasons/);
    assert.match(html, /scheduleIdleTask\(\(\) => \{[\s\S]*fetchEpisodeTitles/);
    assert.match(html, /CatimeApi\.fetchGraphQL\(q, \{ id: animeId \}\)/);
    assert.match(html, /CatimeApi\.fetchGraphQL\(q, \{ id \}\)/);
  });

  it('loads hero descriptions for page-1 trending and enriches before hero init', () => {
    assert.match(html, /async function enrichHeroDescriptions/);
    assert.match(html, /heroDesc \? \{ includeDescription: true \}/);
    assert.match(html, /await enrichHeroDescriptions\(freshItems\)/);
    assert.match(html, /initHeroSlider\(freshItems\)/);
  });

  it('defers recommendations until idle', () => {
    assert.match(html, /scheduleIdleTask\(\(\) => loadRecommendations\(\)/);
  });

});
