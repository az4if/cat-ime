/**
 * Cat-ime feature pack: routing, stats, detail drawer, airing, seasonal, queue, ratings.
 */
(function (global) {
  const QUEUE_KEY = 'watch_queue';
  const WATCH_DAYS_KEY = 'watch_days';
  const RATINGS_KEY = 'user_ratings';
  const NOTES_KEY = 'user_notes';

  function parseJSON(key, fb) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fb;
    } catch {
      return fb;
    }
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function trackWatchDay() {
    const days = parseJSON(WATCH_DAYS_KEY, []);
    const t = todayKey();
    if (!days.includes(t)) {
      days.push(t);
      localStorage.setItem(WATCH_DAYS_KEY, JSON.stringify(days.slice(-400)));
      if (typeof global.markLocalAppDataModified === 'function') global.markLocalAppDataModified();
    }
  }

  function calcStreak(days) {
    if (!days.length) return 0;
    const set = new Set(days);
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 400; i++) {
      const key = d.toISOString().slice(0, 10);
      if (set.has(key)) streak++;
      else if (i > 0) break;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  function getRatings() {
    return parseJSON(RATINGS_KEY, {});
  }

  function getNotes() {
    return parseJSON(NOTES_KEY, {});
  }

  function setRating(id, score) {
    const r = getRatings();
    const n = Number(score);
    if (n > 0) r[id] = n;
    else delete r[id];
    localStorage.setItem(RATINGS_KEY, JSON.stringify(r));
    if (typeof global.markLocalAppDataModified === 'function') global.markLocalAppDataModified();
  }

  function setNote(id, text) {
    const n = getNotes();
    if (text && text.trim()) n[id] = text.trim().slice(0, 500);
    else delete n[id];
    localStorage.setItem(NOTES_KEY, JSON.stringify(n));
    if (typeof global.markLocalAppDataModified === 'function') global.markLocalAppDataModified();
  }

  function getQueue() {
    return parseJSON(QUEUE_KEY, []);
  }

  function saveQueue(q) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(0, 30)));
    if (typeof global.markLocalAppDataModified === 'function') global.markLocalAppDataModified();
    renderQueuePanel();
  }

  function addToQueue(anime) {
    if (!anime?.id) return;
    const q = getQueue().filter((x) => x.id !== anime.id);
    q.push({ id: anime.id, malId: anime.malId, title: anime.title, eps: anime.eps, img: anime.img });
    saveQueue(q);
    if (typeof global.toast === 'function') global.toast('Added to queue');
  }

  function removeFromQueue(id) {
    saveQueue(getQueue().filter((x) => x.id !== id));
  }

  function playNextInQueue() {
    const q = getQueue();
    if (!q.length || typeof global.watchAnime !== 'function') return false;
    const next = q[0];
    saveQueue(q.slice(1));
    global.watchAnime(next);
    return true;
  }

  function updateRoute(page, animeId, ep, audio) {
    const url = new URL(location.href);
    if (!page) {
      url.searchParams.delete('page');
      url.searchParams.delete('anime');
      url.searchParams.delete('ep');
      url.searchParams.delete('audio');
      history.replaceState({}, '', url);
      return;
    }
    url.searchParams.set('page', page);
    if (page === 'watch' && animeId) {
      url.searchParams.set('anime', String(animeId));
      url.searchParams.set('ep', String(ep || 1));
      const mode = audio || localStorage.getItem('pref_ds') || 'sub';
      if (mode === 'sub' || mode === 'dub') url.searchParams.set('audio', mode);
    } else {
      url.searchParams.delete('anime');
      url.searchParams.delete('ep');
      url.searchParams.delete('audio');
    }
    history.replaceState({ page, animeId, ep, audio }, '', url);
  }

  async function fetchMediaById(id) {
    const q = `query($id: Int){ Media(id: $id) { id idMal title { english romaji } description(asHtml: false) episodes averageScore status format season seasonYear genres startDate { year } coverImage { large extraLarge } bannerImage trailer { id site } } }`;
    const d = await global.CatimeApi.fetchGraphQL(q, { id: Number(id) });
    return d?.data?.Media || null;
  }

  function mediaToCard(m) {
    return {
      id: m.id,
      malId: m.idMal,
      title: m.title.english || m.title.romaji || 'Unknown',
      eps: m.episodes || 24,
      score: m.averageScore ? (m.averageScore / 10).toFixed(1) : '?',
      img: m.coverImage?.large,
      banner: m.bannerImage || null,
      dubbed: true
    };
  }

  async function openDetailDrawer(animeOrId) {
    const id = typeof animeOrId === 'object' ? animeOrId.id : animeOrId;
    const drawer = document.getElementById('detailDrawer');
    const body = document.getElementById('detailDrawerBody');
    if (!drawer || !body) return;
    drawer.classList.add('open');
    body.innerHTML = '<div class="detail-loading">Loading...</div>';
    try {
      const m = await fetchMediaById(id);
      if (!m) {
        body.innerHTML = '<div class="detail-loading">Could not load details.</div>';
        return;
      }
      const card = mediaToCard(m);
      const genres = (m.genres || []).join(' · ') || '—';
      const season = m.season && m.seasonYear ? `${m.season} ${m.seasonYear}` : '';
      const desc = (m.description || '').replace(/<[^>]+>/g, '').slice(0, 420);
      const userRate = getRatings()[m.id] || '';
      const userNote = getNotes()[m.id] || '';
      const objJson = JSON.stringify(card).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
      body.innerHTML = `
        <div class="detail-hero" style="background-image:url(${m.bannerImage || m.coverImage?.large || ''})"></div>
        <div class="detail-body">
          <img class="detail-poster" src="${m.coverImage?.large || ''}" alt="">
          <div class="detail-content">
            <h2>${global.sanitizeHTML ? global.sanitizeHTML(card.title) : card.title}</h2>
            <div class="detail-meta">Score ${card.score} · ${card.eps || '?'} eps · ${m.status || ''}${season ? ' · ' + season : ''}</div>
            <div class="detail-genres">${genres}</div>
            <p class="detail-desc">${global.sanitizeHTML ? global.sanitizeHTML(desc) : desc}${(m.description || '').length > 420 ? '…' : ''}</p>
            <div class="detail-actions">
              <button class="btn-p" onclick='closeDetailDrawer(); watchAnime(${objJson})'><span class="icon-play-sm" aria-hidden="true"></span>Watch</button>
              <button class="mkb" onclick='CatimeFeatures.addToQueue(${objJson})'>+ Queue</button>
              <button class="mkb" onclick="CatimeFeatures.shareAnime(${m.id})">Share</button>
            </div>
            <div class="detail-rate">
              <label>Your rating</label>
              <select id="detailRateSelect" onchange="CatimeFeatures.saveDetailRating(${m.id}, this.value)">
                <option value="">—</option>
                ${[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => `<option value="${n}" ${userRate == n ? 'selected' : ''}>${n}/10</option>`).join('')}
              </select>
            </div>
            <textarea class="detail-note" id="detailNoteInput" placeholder="Personal notes..." maxlength="500" onblur="CatimeFeatures.saveDetailNote(${m.id}, this.value)">${global.sanitizeHTML ? global.sanitizeHTML(userNote) : userNote}</textarea>
          </div>
        </div>`;
    } catch (e) {
      body.innerHTML = '<div class="detail-loading">Error loading details.</div>';
    }
  }

  function closeDetailDrawer() {
    document.getElementById('detailDrawer')?.classList.remove('open');
  }

  function shareAnime(id, ep, audio) {
    const url = new URL(location.href);
    url.searchParams.set('page', 'watch');
    url.searchParams.set('anime', String(id));
    if (ep) url.searchParams.set('ep', String(ep));
    else url.searchParams.delete('ep');
    const mode = audio || localStorage.getItem('pref_ds') || 'sub';
    if (mode === 'sub' || mode === 'dub') url.searchParams.set('audio', mode);
    const label = mode === 'dub' ? 'DUB' : 'SUB';
    navigator.clipboard?.writeText(url.toString()).then(() => {
      if (typeof global.toast === 'function') global.toast(`Link copied! (${label})`);
    }).catch(() => {
      if (typeof global.toast === 'function') global.toast(url.toString());
    });
  }

  function saveDetailRating(id, val) {
    setRating(id, val ? Number(val) : 0);
    if (typeof global.toast === 'function') global.toast('Rating saved');
    if (document.getElementById('page-stats')?.classList.contains('active')) loadStatsPage();
    if (typeof global.loadMyList === 'function') global.loadMyList();
  }

  function saveDetailNote(id, val) {
    setNote(id, val);
    if (typeof global.toast === 'function') global.toast('Note saved');
  }

  function syncWatchPageExtras() {
    const anime = getWatchState().anime;
    if (!anime) return;
    const id = anime.id;
    const rateEl = document.getElementById('watchRateSelect');
    const noteEl = document.getElementById('watchNoteInput');
    if (rateEl) rateEl.value = getRatings()[id] || '';
    if (noteEl) noteEl.value = getNotes()[id] || '';
  }

  function getWatchState() {
    return {
      anime: global.curAnime,
      ep: global.curEp || 1
    };
  }

  function bulkMarkWatched(mode) {
    const { anime, ep } = getWatchState();
    if (!anime) return;
    const id = anime.id;
    const total = anime.eps || 1;
    const k = 'w_' + id;
    let eps = new Set(JSON.parse(localStorage.getItem(k) || '[]'));
    if (mode === 'all') {
      for (let i = 1; i <= total; i++) eps.add(i);
    } else if (mode === 'toCurrent') {
      for (let i = 1; i <= ep; i++) eps.add(i);
    } else if (mode === 'clear') {
      eps = new Set();
      localStorage.removeItem('stat_' + id);
      if (global.CatimeStorage?.removeFromContinueWatching) global.CatimeStorage.removeFromContinueWatching(id);
      if (global.CatimeStorage?.clearAllEpisodeProgressForAnime) global.CatimeStorage.clearAllEpisodeProgressForAnime(id);
    }
    localStorage.setItem(k, JSON.stringify([...eps].sort((a, b) => a - b)));
    if (mode === 'all') {
      for (let i = 1; i <= total; i++) global.CatimeStorage?.clearEpisodeProgress?.(id, i);
    } else if (mode === 'toCurrent') {
      for (let i = 1; i <= ep; i++) global.CatimeStorage?.clearEpisodeProgress?.(id, i);
    }
    if (eps.size >= total) localStorage.setItem('stat_' + id, 'sc');
    if (typeof global.markLocalAppDataModified === 'function') global.markLocalAppDataModified();
    if (typeof global.buildEpList === 'function') global.buildEpList(anime, total, global._lastEpTitles || []);
    if (typeof global.loadMyList === 'function') global.loadMyList();
    if (typeof global.refreshCwAndRecommendations === 'function') global.refreshCwAndRecommendations();
    if (typeof global.toast === 'function') global.toast(mode === 'clear' ? 'Progress cleared' : 'Episodes marked watched');
  }

  function getWatchStats() {
    let totalEps = 0;
    let showCount = 0;
    const genreCounts = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('w_')) continue;
      const eps = parseJSON(key, []);
      if (eps.length) {
        showCount++;
        totalEps += eps.length;
      }
    }
    const followed = parseJSON('followed', []);
    const completed = followed.filter((id) => localStorage.getItem('stat_' + id) === 'sc').length;
    const days = parseJSON(WATCH_DAYS_KEY, []);
    return {
      totalEps,
      showCount,
      listSize: followed.length,
      completed,
      streak: calcStreak(days),
      daysActive: days.length,
      estHours: Math.round(totalEps * 24 / 60)
    };
  }

  function loadStatsPage() {
    const el = document.getElementById('statsContent');
    if (!el) return;
    const s = getWatchStats();
    const ratings = getRatings();
    const ratedCount = Object.keys(ratings).length;
    el.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-num">${s.totalEps}</div><div class="stat-lbl">Episodes watched</div></div>
        <div class="stat-card"><div class="stat-num">${s.showCount}</div><div class="stat-lbl">Shows tracked</div></div>
        <div class="stat-card"><div class="stat-num">${s.completed}</div><div class="stat-lbl">Completed</div></div>
        <div class="stat-card"><div class="stat-num">${s.listSize}</div><div class="stat-lbl">On your list</div></div>
        <div class="stat-card accent"><div class="stat-num">${s.streak}</div><div class="stat-lbl">Day streak</div></div>
        <div class="stat-card"><div class="stat-num">~${s.estHours}h</div><div class="stat-lbl">Est. watch time</div></div>
        <div class="stat-card"><div class="stat-num">${ratedCount}</div><div class="stat-lbl">Your ratings</div></div>
        <div class="stat-card"><div class="stat-num">${s.daysActive}</div><div class="stat-lbl">Active days</div></div>
      </div>
      <p class="stats-hint">Stats are based on local watch progress. ~24 min per episode estimated.</p>`;
  }

  function getCurrentSeasonYear() {
    const m = new Date().getMonth();
    const y = new Date().getFullYear();
    if (m <= 2) return { season: 'WINTER', year: y };
    if (m <= 5) return { season: 'SPRING', year: y };
    if (m <= 8) return { season: 'SUMMER', year: y };
    return { season: 'FALL', year: y };
  }

  async function loadAiringThisWeek() {
    const scroll = document.getElementById('airingScroll');
    const status = document.getElementById('airingStatus');
    if (!scroll) return;
    CatimeUI.renderSkeletonScroll('airingScroll', 6);
    CatimeUI.setStatus('airingStatus', 'Loading airing anime...');
    const q = `query { Page(page:1, perPage:24) { media(type:ANIME, status:RELEASING, sort:POPULARITY_DESC, isAdult:false) { id idMal title { english romaji } episodes averageScore coverImage { large } nextAiringEpisode { episode airingAt } } } }`;
    try {
      const d = await CatimeApi.fetchGraphQL(q, {});
      scroll.innerHTML = '';
      const media = d?.data?.Page?.media || [];
      if (!media.length) {
        CatimeUI.showSectionEmpty('airingScroll', 'airingStatus', 'No airing anime found.');
        return;
      }
      const list = media.map((m) => ({
        id: m.id,
        malId: m.idMal,
        title: m.title.english || m.title.romaji || 'Unknown',
        eps: m.episodes || 24,
        score: m.averageScore ? (m.averageScore / 10).toFixed(1) : '?',
        img: m.coverImage.large,
        dubbed: true,
        sub: m.nextAiringEpisode ? `Ep ${m.nextAiringEpisode.episode} soon` : ''
      }));
      list.forEach((a, idx) => {
        const card = global.makeCard ? global.makeCard(a) : null;
        if (card) {
          if (a.sub) {
            const meta = card.querySelector('.acard-meta');
            if (meta) meta.innerHTML += `<span>${a.sub}</span>`;
          }
          card.classList.add('fade-in');
          card.style.animationDelay = `${Math.min(idx * 45, 360)}ms`;
          scroll.appendChild(card);
        }
      });
      CatimeUI.setStatus('airingStatus', '');
    } catch (e) {
      CatimeUI.showSectionError('airingScroll', 'airingStatus', 'Could not load airing anime.', loadAiringThisWeek);
    }
  }

  async function loadSeasonalHub() {
    const scroll = document.getElementById('seasonalScroll');
    if (!scroll) return;
    const { season, year } = getCurrentSeasonYear();
    const titleEl = document.getElementById('seasonalTitle');
    if (titleEl) titleEl.textContent = `${season.charAt(0) + season.slice(1).toLowerCase()} ${year}`;
    CatimeUI.renderSkeletonScroll('seasonalScroll', 6);
    CatimeUI.setStatus('seasonalStatus', 'Loading seasonal anime...');
    try {
      const { items } = await global.fetchAnilistPage('', '', 1, 24, season, String(year), 'POPULARITY_DESC');
      scroll.innerHTML = '';
      if (!items.length) {
        CatimeUI.showSectionEmpty('seasonalScroll', 'seasonalStatus', 'No seasonal anime found.');
        return;
      }
      if (global.appendHorizontalScroll) global.appendHorizontalScroll('seasonalScroll', items, true);
      CatimeUI.setStatus('seasonalStatus', '');
    } catch (e) {
      CatimeUI.showSectionError('seasonalScroll', 'seasonalStatus', 'Could not load seasonal anime.', loadSeasonalHub);
    }
  }

  function renderQueuePanel() {
    const el = document.getElementById('queueList');
    if (!el) return;
    const q = getQueue();
    if (!q.length) {
      el.innerHTML = '<div class="queue-empty">Queue is empty. Add shows from the watch page.</div>';
      return;
    }
    el.innerHTML = q.map((a, i) => {
      const obj = JSON.stringify(a).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
      const title = (global.sanitizeHTML ? global.sanitizeHTML(a.title) : a.title);
      return `<div class="queue-item"><span class="queue-num">${i + 1}</span><span class="queue-title" onclick='watchAnime(${obj})'>${title}</span><button type="button" class="queue-rm btn-icon-remove" aria-label="Remove from queue" onclick="CatimeFeatures.removeFromQueue(${a.id})">x</button></div>`;
    }).join('');
  }

  async function handleDeepLink() {
    const params = new URLSearchParams(location.search);
    const page = params.get('page');
    const animeId = params.get('anime');
    const ep = Math.max(1, parseInt(params.get('ep') || '1', 10) || 1);
    const audioParam = params.get('audio');
    const audio = audioParam === 'sub' || audioParam === 'dub' ? audioParam : undefined;
    if (page && page !== 'home' && typeof global.goPage === 'function') global.goPage(page);
    if (animeId && typeof global.watchAnime === 'function') {
      const m = await fetchMediaById(animeId);
      if (m) global.watchAnime(mediaToCard(m), { ep, audio });
    }
  }

  let sourceFailoverTimer = null;
  let playbackCtx = { id: null, ep: null, seconds: 0 };
  let progressListenerBound = false;
  let lastProgressSaveAt = 0;

  function extractPlaybackSeconds(data) {
    let o = data;
    if (typeof o === 'string') {
      try { o = JSON.parse(o); } catch { return null; }
    }
    if (!o || typeof o !== 'object') return null;
    const candidates = [
      o.currentTime,
      o.current,
      o.time,
      o.position,
      o.played,
      o.seconds,
      o.data?.currentTime,
      o.data?.current,
      o.data?.time,
      o.payload?.currentTime,
      o.detail?.currentTime,
      o.progress?.current
    ];
    for (const c of candidates) {
      const n = Number(c);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    const type = String(o.type || o.event || '').toLowerCase();
    if (type.includes('time') || type.includes('progress')) {
      const n = Number(o.value ?? o.t ?? o.currentTime);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    return null;
  }

  function bindPlaybackContext(animeId, ep) {
    playbackCtx = { id: Number(animeId), ep: Number(ep), seconds: 0 };
  }

  function flushEpisodeProgress() {
    const { id, ep, seconds } = playbackCtx;
    if (!id || !ep || seconds < (global.CatimeStorage?.PROG_MIN_SEC || 15)) return;
    if (global.CatimeStorage?.setEpisodeProgress) {
      global.CatimeStorage.setEpisodeProgress(id, ep, seconds);
      if (typeof global.markLocalAppDataModified === 'function') global.markLocalAppDataModified();
    }
  }

  function ensurePlayerProgressListener() {
    if (progressListenerBound) return;
    progressListenerBound = true;

    const onMessage = (event) => {
      if (!event.origin || !/vidnest\.fun/i.test(event.origin)) return;
      const sec = extractPlaybackSeconds(event.data);
      if (sec == null || !playbackCtx.id) return;
      playbackCtx.seconds = Math.max(playbackCtx.seconds, sec);
      const now = Date.now();
      if (now - lastProgressSaveAt < 4000) return;
      lastProgressSaveAt = now;
      if (global.CatimeStorage?.setEpisodeProgress) {
        global.CatimeStorage.setEpisodeProgress(playbackCtx.id, playbackCtx.ep, sec);
      }
    };

    global.addEventListener('message', onMessage);
    global.addEventListener('pagehide', flushEpisodeProgress);
    global.addEventListener('beforeunload', flushEpisodeProgress);
  }

  function onPlayerLoad(animeId, ep) {
    clearTimeout(sourceFailoverTimer);
    trackWatchDay();
    if (animeId != null && ep != null) bindPlaybackContext(animeId, ep);
    ensurePlayerProgressListener();
    if (localStorage.getItem('pref_autofailover') === 'false') return;
    sourceFailoverTimer = setTimeout(() => {
      if (!document.getElementById('page-watch')?.classList.contains('active')) return;
      if (typeof global.toast === 'function') global.toast('Player slow? Press R to try the other source');
    }, 18000);
  }

  function rotateSource() {
    if (typeof global.setSrc !== 'function') return;
    const cur = localStorage.getItem('pref_source') || 'vidnest';
    const next = cur === 'vidnest' ? 'animepahe' : 'vidnest';
    global.setSrc(next);
    if (typeof global.toast === 'function') global.toast('Switched to ' + next);
  }

  async function pickRandomFromList() {
    const f = parseJSON('followed', []);
    const planOnly = f.filter((id) => {
      const st = localStorage.getItem('stat_' + id);
      return st === 'spl' || st === 'sw' || !st;
    });
    const ids = planOnly.length ? planOnly : f;
    if (!ids.length) {
      if (typeof global.toast === 'function') global.toast('Follow some anime first!');
      return;
    }
    const pick = ids[Math.floor(Math.random() * ids.length)];
    const m = await fetchMediaById(pick);
    if (m && typeof global.watchAnime === 'function') {
      global.toast('Random from your list: ' + (m.title.english || m.title.romaji));
      global.watchAnime(mediaToCard(m));
    }
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  function init() {
    registerServiceWorker();
    renderQueuePanel();
    setTimeout(handleDeepLink, 800);
  }

  function enhanceMakeCard(original) {
    return function (a) {
      const card = original(a);
      const info = document.createElement('button');
      info.type = 'button';
      info.className = 'acard-info-btn';
      info.title = 'Details';
      info.setAttribute('aria-label', `Details for ${a.title || 'anime'}`);
      info.textContent = 'i';
      info.onclick = (e) => {
        e.stopPropagation();
        openDetailDrawer(a.id);
      };
      card.querySelector('.acard-thumb')?.appendChild(info);
      return card;
    };
  }

  global.CatimeFeatures = {
    init,
    updateRoute,
    openDetailDrawer,
    closeDetailDrawer,
    shareAnime,
    addToQueue,
    removeFromQueue,
    playNextInQueue,
    saveDetailRating,
    saveDetailNote,
    syncWatchPageExtras,
    bulkMarkWatched,
    loadStatsPage,
    loadAiringThisWeek,
    loadSeasonalHub,
    renderQueuePanel,
    onPlayerLoad,
    bindPlaybackContext,
    flushEpisodeProgress,
    rotateSource,
    pickRandomFromList,
    enhanceMakeCard,
    getRatings,
    getNotes,
    getQueue,
    QUEUE_KEY,
    WATCH_DAYS_KEY,
    RATINGS_KEY,
    NOTES_KEY
  };
})(window);
