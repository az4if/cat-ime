import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ROOT } from './helpers/env.mjs';

/**
 * Static guards for mobile CSS/HTML. Does not replace a real device or DevTools check —
 * see tests/README.md § Mobile bug test.
 */
describe('mobile layout (static)', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

  const mobileWatchBlock = (() => {
    const start = html.indexOf('/* Watch page + comments — mobile layout */');
    assert.ok(start > 0, 'mobile watch/comments block missing');
    return html.slice(start, start + 4500);
  })();

  it('sets a responsive viewport meta tag', () => {
    assert.match(html, /<meta name="viewport" content="width=device-width/);
  });

  it('uses tablet and phone breakpoints', () => {
    assert.match(html, /@media \(max-width: 768px\)/);
    assert.match(html, /@media \(max-width: 480px\)/);
  });

  it('collapses watch layout to a single column on mobile', () => {
    const tablet = html.slice(html.indexOf('@media (max-width: 768px)'), html.indexOf('@media (max-width: 480px)'));
    assert.match(tablet, /\.watch-wrap[\s\S]*grid-template-columns:\s*1fr/);
  });

  it('shows hamburger nav and hides desktop links on mobile', () => {
    const tablet = html.slice(html.indexOf('@media (max-width: 768px)'), html.indexOf('@media (max-width: 480px)'));
    assert.match(tablet, /\.hamburger[\s\S]*display:\s*flex/);
    assert.match(tablet, /\.nav-links[\s\S]*display:\s*none/);
  });

  it('uses touch-friendly minimum targets on small screens', () => {
    const phone = html.slice(html.indexOf('@media (max-width: 480px)'), html.indexOf('@media (max-width: 320px)'));
    assert.match(phone, /min-height:\s*44px/);
    assert.match(phone, /iOS touch target/i);
  });

  it('stacks watch control groups and action buttons for narrow screens', () => {
    assert.match(mobileWatchBlock, /\.brow[\s\S]*flex-direction:\s*column/);
    assert.match(mobileWatchBlock, /watch-control-group\[aria-label="Episode actions"\][\s\S]*grid-template-columns/);
  });

  it('sizes comments panel for mobile (stacked form, bounded list, 16px input)', () => {
    assert.match(mobileWatchBlock, /\.ep-comments[\s\S]*width:\s*100%/);
    assert.match(mobileWatchBlock, /\.ep-comments-form[\s\S]*flex-direction:\s*column/);
    assert.match(mobileWatchBlock, /\.ep-comments-form textarea[\s\S]*font-size:\s*16px/);
    assert.match(mobileWatchBlock, /\.ep-comments-form \.btn-p[\s\S]*width:\s*100%/);
    assert.match(mobileWatchBlock, /\.ep-comments-list[\s\S]*max-height:\s*min\(/);
  });

  it('keeps horizontal scroll sections usable on mobile', () => {
    assert.match(html, /\.horizontal-scroll[\s\S]*-webkit-overflow-scrolling:\s*touch/);
    assert.match(html, /@media \(max-width: 768px\)[\s\S]*\.scroll-nav-btn[\s\S]*display:\s*none/);
  });

  it('adapts detail drawer for small screens', () => {
    assert.match(mobileWatchBlock, /\.detail-drawer-inner[\s\S]*max-height/);
    assert.match(mobileWatchBlock, /\.detail-body[\s\S]*flex-direction:\s*column/);
  });

  it('includes watch comments markup on the watch page', () => {
    assert.match(html, /id="watchCommentsPanel"/);
    assert.match(html, /id="watchCommentsForm"/);
    assert.match(html, /class="ep-comments"/);
  });
});
