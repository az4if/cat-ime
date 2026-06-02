/**
 * Per-episode comments (Supabase). Public read; post/delete when signed in.
 */
(function (global) {
  const MAX_LEN = 1000;

  function client() {
    return typeof global.getSupabaseClient === 'function' ? global.getSupabaseClient() : null;
  }

  function user() {
    return typeof global.getCurrentUser === 'function' ? global.getCurrentUser() : null;
  }

  function esc(s) {
    return global.sanitizeHTML ? global.sanitizeHTML(String(s ?? '')) : String(s ?? '');
  }

  async function fetchComments(anilistId, episode) {
    const sb = client();
    if (!sb) return { data: [], error: { message: 'Database not available' } };
    return sb
      .from('episode_comments')
      .select('id, body, created_at, user_id, profiles(username, avatar_url)')
      .eq('anilist_id', Number(anilistId))
      .eq('episode', Number(episode))
      .order('created_at', { ascending: true })
      .limit(200);
  }

  async function postComment(anilistId, episode, body) {
    const u = user();
    if (!u) return { data: null, error: { message: 'Sign in to comment' } };
    const sb = client();
    if (!sb) return { data: null, error: { message: 'Database not available' } };
    const text = String(body || '').trim();
    if (!text) return { data: null, error: { message: 'Comment cannot be empty' } };
    if (text.length > MAX_LEN) return { data: null, error: { message: 'Comment is too long' } };
    return sb
      .from('episode_comments')
      .insert({
        anilist_id: Number(anilistId),
        episode: Number(episode),
        user_id: u.id,
        body: text,
      })
      .select('id, body, created_at, user_id, profiles(username, avatar_url)')
      .single();
  }

  async function deleteComment(id) {
    const u = user();
    if (!u) return { error: { message: 'Sign in required' } };
    const sb = client();
    if (!sb) return { error: { message: 'Database not available' } };
    return sb.from('episode_comments').delete().eq('id', id).eq('user_id', u.id);
  }

  function formatTime(iso) {
    try {
      const d = new Date(iso);
      const diff = Date.now() - d.getTime();
      if (diff < 60000) return 'just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      return d.toLocaleDateString();
    } catch {
      return '';
    }
  }

  function renderCommentRow(c, currentUserId) {
    const profile = c.profiles || {};
    const name = profile.username || 'User';
    const initial = name.charAt(0).toUpperCase();
    const avatar = profile.avatar_url;
    const own = currentUserId && c.user_id === currentUserId;
    const delBtn = own
      ? `<button type="button" class="ep-comment-del" data-id="${esc(c.id)}" aria-label="Delete comment">×</button>`
      : '';
    const av = avatar
      ? `<img class="ep-comment-avatar" src="${esc(avatar)}" alt="" referrerpolicy="no-referrer">`
      : `<span class="ep-comment-avatar ep-comment-avatar--initial" aria-hidden="true">${esc(initial)}</span>`;
    return `<article class="ep-comment" data-id="${esc(c.id)}">
      ${av}
      <div class="ep-comment-main">
        <div class="ep-comment-hd">
          <strong class="ep-comment-user">${esc(name)}</strong>
          <time class="ep-comment-time">${esc(formatTime(c.created_at))}</time>
          ${delBtn}
        </div>
        <p class="ep-comment-text">${esc(c.body)}</p>
      </div>
    </article>`;
  }

  function syncCommentFormState() {
    const u = user();
    const input = document.getElementById('watchCommentInput');
    const submit = document.getElementById('watchCommentSubmit');
    if (input) {
      input.disabled = !u;
      input.placeholder = u ? 'Add a comment…' : 'Sign in to comment';
    }
    if (submit) submit.disabled = !u;
  }

  async function loadWatchPanel(anilistId, episode) {
    const listEl = document.getElementById('watchCommentsList');
    const metaEl = document.getElementById('watchCommentsMeta');
    if (!listEl) return;

    syncCommentFormState();
    if (metaEl) metaEl.textContent = `Episode ${episode}`;

    listEl.innerHTML = '<div class="ep-comments-status">Loading comments…</div>';

    const { data, error } = await fetchComments(anilistId, episode);
    const u = user();

    if (error) {
      console.warn('Comments load failed:', error);
      listEl.innerHTML = '<div class="ep-comments-status">Could not load comments.</div>';
      return;
    }

    if (!data?.length) {
      listEl.innerHTML = '<div class="ep-comments-status">No comments yet. Be the first!</div>';
      return;
    }

    listEl.innerHTML = data.map((c) => renderCommentRow(c, u?.id)).join('');
    listEl.querySelectorAll('.ep-comment-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this comment?')) return;
        const { error: delErr } = await deleteComment(btn.dataset.id);
        if (delErr) {
          if (global.toast) global.toast(delErr.message || 'Could not delete');
          return;
        }
        if (global.toast) global.toast('Comment deleted');
        loadWatchPanel(anilistId, episode);
      });
    });
  }

  function bindWatchForm(getAnime, getEpisode) {
    const form = document.getElementById('watchCommentsForm');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const anime = getAnime();
      const ep = getEpisode();
      if (!anime?.id || !ep) return;

      if (!user()) {
        if (typeof global.showAccountModal === 'function') global.showAccountModal();
        else if (global.toast) global.toast('Sign in to comment');
        return;
      }

      const input = document.getElementById('watchCommentInput');
      const submit = document.getElementById('watchCommentSubmit');
      const text = input?.value || '';
      if (submit) submit.disabled = true;

      const { error } = await postComment(anime.id, ep, text);
      syncCommentFormState();

      if (error) {
        if (global.toast) global.toast(error.message || 'Could not post comment');
        return;
      }

      if (input) input.value = '';
      if (global.toast) global.toast('Comment posted');
      loadWatchPanel(anime.id, ep);
    });
  }

  function init(getAnime, getEpisode) {
    bindWatchForm(getAnime, getEpisode);
    syncCommentFormState();
  }

  global.CatimeComments = {
    init,
    loadWatchPanel,
    syncCommentFormState,
    fetchComments,
    postComment,
    deleteComment,
  };
})(window);
