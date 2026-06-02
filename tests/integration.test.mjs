import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatimeStack } from './helpers/env.mjs';

describe('Integration flows', () => {
  it('simulate account B login after A left data in storage', () => {
    const { storage, CatimeStorage: S, CatimeAppData: D } = loadCatimeStack();
    const api = () => S;

    S.toggleMyListId(1000);
    D.rememberSignedInAccount(storage, 'account-a');

    const accountChanged = D.isDifferentSignedInAccount(storage, 'account-b');
    assert.ok(accountChanged);
    D.clearLocalAppData(storage);

    const remoteB = {
      syncedAt: '2026-05-01T12:00:00.000Z',
      my_list: [2000],
      episode_follows: [2000],
      cw: [{ id: 2000, ep: 1, ts: 1 }],
      watched: { w_2000: '[1]' },
      statuses: { stat_2000: 'sw' },
      preferences: { pref_ds: 'sub' }
    };
    D.applySyncedAppData(storage, api, remoteB, { replaceWatchKeys: true });
    D.rememberSignedInAccount(storage, 'account-b');

    assert.equal(JSON.stringify(S.getMyListIds()), '[2000]');
    assert.equal(S.getMyListIds().includes(1000), false);
  });

  it('backup import then collect matches', () => {
    const { storage, CatimeStorage: S, CatimeAppData: D } = loadCatimeStack();
    const api = () => S;
    const backup = {
      format: 'cat-ime-backup',
      version: 3,
      syncedAt: '2026-05-01T00:00:00.000Z',
      my_list: [7, 8],
      episode_follows: [8],
      cw: [{ id: 7, ep: 2, ts: 9 }],
      watched: { w_7: '[1,2]', w_8: '[]' },
      statuses: { stat_7: 'sw', stat_8: 'spl' },
      preferences: { pref_ds: 'dub', pref_source: 'megaplay' },
      ratings: '{}',
      watch_queue: '[]',
      watch_days: '[]'
    };
    D.clearLocalAppData(storage);
    D.applySyncedAppData(storage, api, D.normalizeSyncedAppDataForApply(backup), { replaceWatchKeys: true });
    const again = D.collectAppDataForSync(storage, api);
    assert.equal(JSON.stringify(again.my_list), '[7,8]');
    assert.equal(JSON.stringify(again.episode_follows), '[8]');
    assert.equal(again.preferences.pref_ds, 'dub');
  });

  it('sign out flag forces pull path', () => {
    const { storage, CatimeAppData: D } = loadCatimeStack();
    D.markNeedsCloudPullOnSignOut(storage);
    const action = D.planMergeAction({
      accountChanged: false,
      needsPullAfterSignOut: D.consumeNeedsCloudPull(storage),
      remoteAppData: {},
      hasLocal: false,
      remoteTs: 0,
      syncedTs: 0,
      localModTs: 0
    });
    assert.equal(action, 'force_pull');
  });
});
