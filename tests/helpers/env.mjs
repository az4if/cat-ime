/**
 * Minimal browser mocks for loading cat-ime IIFE scripts in Node.
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..', '..');

export function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
    key(i) { return [...map.keys()][i] ?? null; },
    get length() { return map.size; },
    _dump() { return Object.fromEntries(map); }
  };
}

export function createBrowserContext(extra = {}) {
  const storage = extra.localStorage || createMemoryStorage();
  const events = [];
  const keydownListeners = [];
  const CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };
  const ctx = {
    window: {},
    localStorage: storage,
    CustomEvent,
    URL: globalThis.URL,
    document: {
      dispatchEvent(ev) { events.push(ev); },
      getElementById(id) {
        if (id === 'queueList') return { innerHTML: '' };
        if (id === 'page-stats') return { classList: { contains: () => false } };
        return null;
      },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      addEventListener(type, fn) {
        if (type === 'keydown') keydownListeners.push(fn);
      },
      dispatchKeydown(ev) {
        keydownListeners.forEach((fn) => fn(ev));
      }
    },
    console,
    fetch: extra.fetch || (async () => ({ ok: true, json: async () => ({ data: {} }) })),
    location: { href: 'https://example.com/', search: '', searchParams: new URLSearchParams() },
    history: { replaceState() {} },
    navigator: { serviceWorker: undefined, clipboard: undefined },
    setTimeout,
    clearTimeout,
    toast() {},
    markLocalAppDataModified() {},
    ...extra
  };
  ctx.window = ctx;
  return { ctx, storage, events };
}

export function loadScripts(ctx, relativePaths) {
  relativePaths.forEach((rel) => {
    const code = readFileSync(join(ROOT, rel), 'utf8');
    vm.runInNewContext(code, ctx, { filename: rel });
  });
}

export function loadCatimeStack() {
  const { ctx, storage, events } = createBrowserContext();
  loadScripts(ctx, [
    'js/catime-storage.js',
    'js/catime-app-data.js',
    'js/catime-api.js',
    'js/catime-features.js'
  ]);
  return {
    ctx,
    storage,
    events,
    CatimeStorage: ctx.CatimeStorage,
    CatimeAppData: ctx.CatimeAppData,
    CatimeApi: ctx.CatimeApi,
    CatimeFeatures: ctx.CatimeFeatures
  };
}
