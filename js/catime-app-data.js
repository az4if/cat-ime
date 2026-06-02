/**
 * App data backup, restore, and cloud merge helpers (testable, no Supabase).
 */
(function (global) {
  const KEYS = {
    APP_SYNC_TS: 'appData_syncedAt',
    APP_LOCAL_MOD: 'appData_localModifiedAt',
    LAST_ACCOUNT_ID: 'lastSignedInUserId',
    NEEDS_CLOUD_PULL: 'appData_needsCloudPull'
  };

  function storageValueToString(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  }

  function getTimestampMs(iso) {
    if (!iso) return 0;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  function isAppDataStorageKey(key) {
    return key === 'cw' || key === 'followed' || key === 'my_list' || key === 'episode_follows' ||
      key === 'lastReadNotif' || key === 'custom_theme' ||
      key === 'user_ratings' || key === 'watch_queue' || key === 'watch_days' ||
      key.startsWith('w_') || key.startsWith('stat_') || key.startsWith('pref_');
  }

  function normalizeSyncedAppDataForApply(appData) {
    if (!appData || typeof appData !== 'object') return appData;
    const out = { ...appData };

    if (out.watched && typeof out.watched === 'object') {
      const watched = {};
      Object.entries(out.watched).forEach(([key, value]) => {
        if (!key.startsWith('w_')) return;
        const str = storageValueToString(value);
        if (str !== null) watched[key] = str;
      });
      out.watched = watched;
    }

    if (out.statuses && typeof out.statuses === 'object') {
      const statuses = {};
      Object.entries(out.statuses).forEach(([key, value]) => {
        if (!key.startsWith('stat_')) return;
        const str = storageValueToString(value);
        if (str !== null) statuses[key] = str;
      });
      out.statuses = statuses;
    }

    if (out.preferences && typeof out.preferences === 'object') {
      const preferences = {};
      Object.entries(out.preferences).forEach(([key, value]) => {
        const str = storageValueToString(value);
        if (str !== null) preferences[key] = str;
      });
      out.preferences = preferences;
    }

    ['ratings', 'watch_queue', 'watch_days', 'custom_theme', 'lastReadNotif'].forEach((field) => {
      if (out[field] !== undefined && out[field] !== null) {
        const str = storageValueToString(out[field]);
        if (str !== null) out[field] = str;
      }
    });

    return out;
  }

  function isStructuredAppBackup(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.format === 'cat-ime-backup') return true;
    return Boolean(
      data.version >= 1 &&
      (Array.isArray(data.cw) ||
        Array.isArray(data.followed) ||
        Array.isArray(data.my_list) ||
        (data.watched && typeof data.watched === 'object'))
    );
  }

  function isFlatStorageBackup(data) {
    if (!data || typeof data !== 'object' || isStructuredAppBackup(data)) return false;
    return Object.keys(data).some((key) =>
      key === 'cw' || key === 'followed' || key === 'my_list' || key === 'episode_follows' ||
      key.startsWith('w_') || key.startsWith('stat_') ||
      key.startsWith('pref_') || key === 'user_ratings' || key === 'watch_queue' ||
      key === 'watch_days' || key === 'custom_theme' || key === 'lastReadNotif'
    );
  }

  function normalizeRemoteAppData(raw, syncedAt) {
    if (!raw || typeof raw !== 'object') return null;
    return { ...raw, syncedAt: raw.syncedAt || syncedAt || null };
  }

  function isMissingAppDataTableError(error) {
    return error?.code === 'PGRST205' || /user_app_data/.test(error?.message || '');
  }

  function parseLocalJSON(storage, key, fallback) {
    try {
      const value = storage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function hasLocalAppData(storage) {
    return Boolean(
      storage.getItem('cw') ||
      storage.getItem('my_list') ||
      storage.getItem('followed') ||
      storage.getItem('episode_follows') ||
      listStorageKeys(storage).some((key) => key.startsWith('w_') || key.startsWith('stat_'))
    );
  }

  function listStorageKeys(storage) {
    const keys = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k) keys.push(k);
    }
    return keys;
  }

  function clearWatchProgressKeys(storage) {
    listStorageKeys(storage).forEach((key) => {
      if (key.startsWith('w_') || key.startsWith('stat_')) storage.removeItem(key);
    });
  }

  function clearLocalAppData(storage) {
    listStorageKeys(storage).forEach((key) => {
      if (isAppDataStorageKey(key) || key === KEYS.APP_SYNC_TS || key === KEYS.APP_LOCAL_MOD) {
        storage.removeItem(key);
      }
    });
  }

  function applySyncedAppData(storage, getListApi, appData, options = {}) {
    if (!appData || typeof appData !== 'object') return false;
    const { replaceWatchKeys = false } = options;
    const listApi = getListApi();

    if (replaceWatchKeys) clearWatchProgressKeys(storage);

    if (Array.isArray(appData.cw)) storage.setItem('cw', JSON.stringify(appData.cw));

    const myList = Array.isArray(appData.my_list)
      ? appData.my_list
      : (Array.isArray(appData.followed) ? appData.followed : null);
    if (myList && listApi?.setMyListIds) listApi.setMyListIds(myList);

    const episodeFollows = Array.isArray(appData.episode_follows)
      ? appData.episode_follows
      : (Array.isArray(appData.followed) ? appData.followed : null);
    if (episodeFollows && listApi?.setEpisodeFollowIds) listApi.setEpisodeFollowIds(episodeFollows);

    if (appData.watched && typeof appData.watched === 'object') {
      Object.entries(appData.watched).forEach(([key, value]) => {
        if (!key.startsWith('w_')) return;
        const str = storageValueToString(value);
        if (str !== null) storage.setItem(key, str);
      });
    }

    if (appData.statuses && typeof appData.statuses === 'object') {
      Object.entries(appData.statuses).forEach(([key, value]) => {
        if (!key.startsWith('stat_')) return;
        const str = storageValueToString(value);
        if (str !== null) storage.setItem(key, str);
      });
    }

    if (appData.preferences && typeof appData.preferences === 'object') {
      Object.entries(appData.preferences).forEach(([key, value]) => {
        const str = storageValueToString(value);
        if (str === null) return;
        if (key.startsWith('pref_')) storage.setItem(key, str);
        if (key === 'custom_theme' && str) storage.setItem(key, str);
      });
    }

    if (typeof appData.custom_theme === 'string' && appData.custom_theme) {
      storage.setItem('custom_theme', appData.custom_theme);
    }
    if (typeof appData.lastReadNotif === 'string' && appData.lastReadNotif) {
      storage.setItem('lastReadNotif', appData.lastReadNotif);
    }
    if (typeof appData.ratings === 'string') storage.setItem('user_ratings', appData.ratings);
    if (typeof appData.watch_queue === 'string') storage.setItem('watch_queue', appData.watch_queue);
    if (typeof appData.watch_days === 'string') storage.setItem('watch_days', appData.watch_days);

    if (appData.syncedAt) {
      storage.setItem(KEYS.APP_SYNC_TS, appData.syncedAt);
      storage.removeItem(KEYS.APP_LOCAL_MOD);
    }

    return true;
  }

  function collectAppDataForSync(storage, getListApi) {
    const listApi = getListApi();
    const myList = listApi?.getMyListIds ? listApi.getMyListIds() : [];
    const episodeFollows = listApi?.getEpisodeFollowIds ? listApi.getEpisodeFollowIds() : [];
    const watched = {};
    const statuses = {};

    listStorageKeys(storage).forEach((key) => {
      if (key.startsWith('w_')) watched[key] = storage.getItem(key);
      if (key.startsWith('stat_')) statuses[key] = storage.getItem(key);
    });

    myList.forEach((id) => {
      const watchKey = 'w_' + id;
      const statusKey = 'stat_' + id;
      if (storage.getItem(watchKey) !== null) watched[watchKey] = storage.getItem(watchKey);
      if (storage.getItem(statusKey) !== null) statuses[statusKey] = storage.getItem(statusKey);
    });

    const prefs = {
      pref_theme: storage.getItem('pref_theme') ?? '0',
      pref_ds: storage.getItem('pref_ds') || 'sub',
      pref_source: storage.getItem('pref_source') || 'megaplay',
      pref_list_filter: storage.getItem('pref_list_filter') || 'all',
      pref_list_sort: storage.getItem('pref_list_sort') || 'title'
    };
    listStorageKeys(storage).forEach((key) => {
      if (key.startsWith('pref_') && storage.getItem(key) !== null) {
        prefs[key] = storage.getItem(key);
      }
    });

    return {
      version: 3,
      syncedAt: new Date().toISOString(),
      cw: parseLocalJSON(storage, 'cw', []),
      my_list: myList,
      episode_follows: episodeFollows,
      followed: myList,
      watched,
      statuses,
      preferences: prefs,
      custom_theme: storage.getItem('custom_theme') || '',
      lastReadNotif: storage.getItem('lastReadNotif') || '',
      ratings: storage.getItem('user_ratings') || '',
      watch_queue: storage.getItem('watch_queue') || '',
      watch_days: storage.getItem('watch_days') || ''
    };
  }

  function buildAppBackupPayload(storage, getListApi) {
    return {
      format: 'cat-ime-backup',
      exportedAt: new Date().toISOString(),
      ...collectAppDataForSync(storage, getListApi)
    };
  }

  function importFlatBackup(storage, raw) {
    Object.keys(raw).forEach((key) => {
      if (!isAppDataStorageKey(key) && key !== 'custom_theme' && key !== 'lastReadNotif') return;
      const str = storageValueToString(raw[key]);
      if (str !== null) storage.setItem(key, str);
    });
  }

  function isDifferentSignedInAccount(storage, userId) {
    if (!userId) return false;
    return storage.getItem(KEYS.LAST_ACCOUNT_ID) !== userId;
  }

  function rememberSignedInAccount(storage, userId) {
    if (userId) storage.setItem(KEYS.LAST_ACCOUNT_ID, userId);
  }

  function markNeedsCloudPullOnSignOut(storage) {
    storage.setItem(KEYS.NEEDS_CLOUD_PULL, '1');
  }

  function consumeNeedsCloudPull(storage) {
    const needs = storage.getItem(KEYS.NEEDS_CLOUD_PULL) === '1';
    if (needs) storage.removeItem(KEYS.NEEDS_CLOUD_PULL);
    return needs;
  }

  /**
   * Pure merge decision (last-write-wins + account switch).
   * @returns {'force_pull'|'pull'|'push'|'none'}
   */
  function planMergeAction({
    accountChanged,
    needsPullAfterSignOut,
    remoteAppData,
    hasLocal,
    remoteTs,
    syncedTs,
    localModTs
  }) {
    const forceAccountLoad = accountChanged || needsPullAfterSignOut;
    if (forceAccountLoad) return 'force_pull';
    if (remoteAppData && (!hasLocal || remoteTs > localModTs)) {
      if (remoteTs > syncedTs || !hasLocal) return 'pull';
    }
    if (localModTs > remoteTs && (localModTs > syncedTs || !remoteAppData)) return 'push';
    return 'none';
  }

  global.CatimeAppData = {
    KEYS,
    storageValueToString,
    getTimestampMs,
    isAppDataStorageKey,
    normalizeSyncedAppDataForApply,
    isStructuredAppBackup,
    isFlatStorageBackup,
    normalizeRemoteAppData,
    isMissingAppDataTableError,
    hasLocalAppData,
    clearLocalAppData,
    clearWatchProgressKeys,
    applySyncedAppData,
    collectAppDataForSync,
    buildAppBackupPayload,
    importFlatBackup,
    isDifferentSignedInAccount,
    rememberSignedInAccount,
    markNeedsCloudPullOnSignOut,
    consumeNeedsCloudPull,
    planMergeAction,
    listStorageKeys
  };
})(typeof window !== 'undefined' ? window : globalThis);
