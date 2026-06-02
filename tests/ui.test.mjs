import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserContext, loadScripts } from './helpers/env.mjs';

describe('CatimeUI', () => {
  function ui() {
    const { ctx } = createBrowserContext();
    loadScripts(ctx, ['js/catime-ui.js']);
    return { ctx, CatimeUI: ctx.CatimeUI };
  }

  it('setStatus updates element text', () => {
    const { ctx, CatimeUI } = ui();
    const el = { textContent: '' };
    ctx.document.getElementById = (id) => (id === 'statusBox' ? el : null);
    CatimeUI.setStatus('statusBox', 'Loading…');
    assert.equal(el.textContent, 'Loading…');
  });

  it('showSectionEmpty renders message', () => {
    const { ctx, CatimeUI } = ui();
    const box = { innerHTML: '' };
    ctx.document.getElementById = (id) => (id === 'grid' ? box : null);
    CatimeUI.showSectionEmpty('grid', 'gridStatus', 'Nothing here');
    assert.match(box.innerHTML, /Nothing here/);
  });

  it('keyboard shortcut / goes to search', () => {
    const { ctx, CatimeUI } = ui();
    const pages = [];
    const search = { focus: () => {} };
    ctx.document.getElementById = (id) => {
      if (id === 'searchInput') return search;
      if (id === 'page-watch') return { classList: { contains: () => false } };
      return null;
    };
    CatimeUI.initKeyboardShortcuts({ goPage: (p) => pages.push(p) });
    ctx.document.dispatchKeydown({
      key: '/',
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      target: { tagName: 'BODY' },
      preventDefault() {}
    });
    assert.deepEqual(pages, ['search']);
  });
});
