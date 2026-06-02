import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ROOT } from './helpers/env.mjs';

describe('catime-comments (static checks)', () => {
  const src = readFileSync(join(ROOT, 'js/catime-comments.js'), 'utf8');

  it('escapes HTML via sanitizeHTML in render path', () => {
    assert.match(src, /function esc\(s\)/);
    assert.match(src, /sanitizeHTML/);
    assert.match(src, /esc\(c\.body\)/);
  });

  it('enforces max body length', () => {
    assert.match(src, /maxlength|1000/);
  });
});
