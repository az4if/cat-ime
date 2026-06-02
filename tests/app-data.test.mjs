import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatimeStack } from './helpers/env.mjs';

describe('CatimeAppData', () => {
  function stack() {
    return loadCatimeStack();
  }

  it('detects structured and flat backups', () => {
    const { CatimeAppData: D } = stack();
    assert.ok(D.isStructuredAppBackup({ format: 'cat-ime-backup', version: 3, cw: [] }));
    assert.ok(D.isFlatStorageBackup({ cw: '[]', pref_ds: 'sub' }));
    assert.equal(D.isFlatStorageBackup({ format: 'cat-ime-backup', version: 3 }), false);
  });

  it('normalizes watched arrays for apply', () => {
    const { CatimeAppData: D } = stack();
    const out = D.normalizeSyncedAppDataForApply({
      watched: { w_1: [1, 2] },
      statuses: { stat_1: 'sw' }
    });
    assert.equal(out.watched.w_1, '[1,2]');
    assert.equal(out.statuses.stat_1, 'sw');
  });

  it('collect and apply round-trip preserves list, follow, cw, progress', () => {
    const { storage, CatimeStorage: S, CatimeAppData: D } = stack();
    const api = () => S;
    S.toggleMyListId(101);
    S.toggleEpisodeFollowId(202);
    S.updateContinueWatching(101, 3);
    storage.setItem('w_101', JSON.stringify([1, 2]));
    storage.setItem('stat_101', 'sw');
    storage.setItem('pref_ds', 'dub');
    storage.setItem('user_ratings', JSON.stringify({ 101: 8 }));

    const payload = D.collectAppDataForSync(storage, api);
    D.clearLocalAppData(storage);
    assert.equal(S.getMyListIds().length, 0);

    D.applySyncedAppData(storage, api, payload, { replaceWatchKeys: true });
    assert.equal(JSON.stringify(S.getMyListIds()), '[101]');
    assert.equal(JSON.stringify(S.getEpisodeFollowIds()), '[202]');
    assert.equal(JSON.parse(storage.getItem('cw'))[0].id, 101);
    assert.equal(storage.getItem('w_101'), JSON.stringify([1, 2]));
    assert.equal(storage.getItem('pref_ds'), 'dub');
  });

  it('export payload includes format and separate lists', () => {
    const { storage, CatimeStorage: S, CatimeAppData: D } = stack();
    S.toggleMyListId(1);
    S.toggleEpisodeFollowId(2);
    const payload = D.buildAppBackupPayload(storage, () => S);
    assert.equal(payload.format, 'cat-ime-backup');
    assert.equal(JSON.stringify(payload.my_list), '[1]');
    assert.equal(JSON.stringify(payload.episode_follows), '[2]');
  });

  it('flat import restores keys', () => {
    const { storage, CatimeAppData: D } = stack();
    D.importFlatBackup(storage, {
      cw: JSON.stringify([{ id: 5, ep: 1, ts: 1 }]),
      my_list: JSON.stringify([5]),
      pref_theme: '2'
    });
    assert.ok(storage.getItem('cw'));
    assert.equal(storage.getItem('pref_theme'), '2');
  });

  it('planMergeAction covers account switch, pull, push, none', () => {
    const { CatimeAppData: D } = stack();
    assert.equal(D.planMergeAction({
      accountChanged: true,
      needsPullAfterSignOut: false,
      remoteAppData: {},
      hasLocal: true,
      remoteTs: 0,
      syncedTs: 0,
      localModTs: 999
    }), 'force_pull');

    assert.equal(D.planMergeAction({
      accountChanged: false,
      needsPullAfterSignOut: false,
      remoteAppData: { syncedAt: '2026-01-02T00:00:00.000Z' },
      hasLocal: true,
      remoteTs: 2000,
      syncedTs: 1000,
      localModTs: 500
    }), 'pull');

    assert.equal(D.planMergeAction({
      accountChanged: false,
      needsPullAfterSignOut: false,
      remoteAppData: { syncedAt: '2026-01-01T00:00:00.000Z' },
      hasLocal: true,
      remoteTs: 1000,
      syncedTs: 500,
      localModTs: 2000
    }), 'push');

    assert.equal(D.planMergeAction({
      accountChanged: false,
      needsPullAfterSignOut: false,
      remoteAppData: { syncedAt: '2026-01-02T00:00:00.000Z' },
      hasLocal: true,
      remoteTs: 2000,
      syncedTs: 3000,
      localModTs: 500
    }), 'none');
  });

  it('account helpers track last user and sign-out pull flag', () => {
    const { storage, CatimeAppData: D } = stack();
    D.rememberSignedInAccount(storage, 'user-a');
    assert.ok(D.isDifferentSignedInAccount(storage, 'user-b'));
    D.markNeedsCloudPullOnSignOut(storage);
    assert.ok(D.consumeNeedsCloudPull(storage));
    assert.equal(D.consumeNeedsCloudPull(storage), false);
  });

  it('clearLocalAppData removes app keys but keeps profile keys', () => {
    const { storage, CatimeAppData: D } = stack();
    storage.setItem('my_list', '[1]');
    storage.setItem('pref_ds', 'dub');
    storage.setItem('profile_abc', '{"username":"cat"}');
    storage.setItem('hasSeenAccountPrompt', 'true');
    D.clearLocalAppData(storage);
    assert.equal(storage.getItem('my_list'), null);
    assert.equal(storage.getItem('pref_ds'), null);
    assert.ok(storage.getItem('profile_abc'));
    assert.ok(storage.getItem('hasSeenAccountPrompt'));
  });

  it('replaceWatchKeys drops orphan progress on apply', () => {
    const { storage, CatimeStorage: S, CatimeAppData: D } = stack();
    const api = () => S;
    storage.setItem('w_99', '[1,2,3]');
    storage.setItem('w_100', '[1]');
    D.applySyncedAppData(storage, api, {
      my_list: [100],
      watched: { w_100: '[1,2]' },
      statuses: { stat_100: 'sw' }
    }, { replaceWatchKeys: true });
    assert.equal(storage.getItem('w_99'), null);
    assert.equal(storage.getItem('w_100'), '[1,2]');
  });

  it('isMissingAppDataTableError detects PGRST205', () => {
    const { CatimeAppData: D } = stack();
    assert.ok(D.isMissingAppDataTableError({ code: 'PGRST205' }));
    assert.ok(D.isMissingAppDataTableError({ message: 'user_app_data missing' }));
    assert.equal(D.isMissingAppDataTableError({ code: 'OTHER' }), false);
  });
});
