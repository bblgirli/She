/* WhatsApp Chats UI adapter. app.js remains the single source of chat/Firebase data. */
(() => {
  'use strict';

  const USER_KEY = 'she_current_user';
  // Bump whenever the chat-row DOM structure changes so an old cached row can never
  // bring the pre-WhatsApp layout back after iOS/Android resumes the page.
  const CACHE_PREFIX = 'she_chats_dom_v9_';
  let restoring = false;
  let saveTimer = 0;

  const list = () => document.getElementById('chatList') || document.querySelector('.chat-list');
  const user = () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } };
  const cacheKey = uid => CACHE_PREFIX + uid;

  function installCSS() {
    if (document.getElementById('sheWhatsAppChatCSS')) return;
    const style = document.createElement('style');
    style.id = 'sheWhatsAppChatCSS';
    style.textContent = `
      html, body { width:100%; max-width:100%; margin:0; padding:0; overflow:hidden; }
      .phone-app { width:100%!important; max-width:none!important; min-height:100dvh; height:100dvh; box-sizing:border-box; display:flex; flex-direction:column; overflow:hidden; }
      .chat-list { flex:1 1 auto!important; min-height:0!important; width:100%!important; overflow-x:hidden!important; overflow-y:auto!important; -webkit-overflow-scrolling:touch!important; padding:0 0 calc(92px + env(safe-area-inset-bottom))!important; }
      #chatList .chat-item { position:relative!important; width:100%!important; min-height:74px!important; box-sizing:border-box!important; display:flex!important; align-items:center!important; margin:0!important; padding:10px max(15px,env(safe-area-inset-right)) 10px max(15px,env(safe-area-inset-left))!important; overflow:hidden!important; }
      #chatList .chat-avatar { flex:0 0 52px!important; width:52px!important; min-width:52px!important; height:52px!important; margin-right:13px!important; border-radius:50%!important; overflow:hidden!important; }
      #chatList .chat-avatar img { width:100%!important; height:100%!important; object-fit:cover!important; display:block!important; }
      #chatList .chat-info { flex:1 1 auto!important; min-width:0!important; width:auto!important; overflow:hidden!important; }
      #chatList .chat-top { display:block!important; width:100%!important; min-width:0!important; }
      #chatList .chat-top h3 { width:100%!important; min-width:0!important; margin:0!important; overflow:hidden!important; text-overflow:ellipsis!important; white-space:nowrap!important; }
      #chatList .chat-bottom { display:flex!important; align-items:center!important; width:100%!important; min-width:0!important; margin-top:3px!important; }
      #chatList .chat-preview { display:flex!important; align-items:center!important; min-width:0!important; flex:1 1 auto!important; overflow:hidden!important; }
      #chatList .chat-bottom p { min-width:0!important; flex:1 1 auto!important; margin:0!important; overflow:hidden!important; text-overflow:ellipsis!important; white-space:nowrap!important; }
      #chatList .chat-right { flex:0 0 68px!important; width:68px!important; min-width:68px!important; height:52px!important; margin-left:10px!important; display:flex!important; flex-direction:column!important; align-items:flex-end!important; justify-content:flex-start!important; gap:5px!important; box-sizing:border-box!important; }
      #chatList .chat-right .message-time { position:static!important; display:block!important; width:68px!important; margin:0!important; padding:0!important; text-align:right!important; white-space:nowrap!important; font-size:11px!important; line-height:16px!important; }
      #chatList .chat-right .unread-badge { position:static!important; flex:0 0 20px!important; width:20px!important; min-width:20px!important; height:20px!important; margin:0!important; padding:0!important; border-radius:50%!important; display:flex!important; align-items:center!important; justify-content:center!important; box-sizing:border-box!important; font-size:11px!important; font-weight:700!important; background:#078b59!important; color:#fff!important; }
      #chatList .chat-right .unread-placeholder { width:20px!important; height:20px!important; visibility:hidden!important; }
      #chatList .chat-date-separator { width:100%!important; box-sizing:border-box!important; padding:8px 16px 4px!important; font-size:11px!important; font-weight:700!important; color:#078b59!important; text-transform:uppercase!important; }
      .bottom-nav { position:fixed!important; left:0!important; right:0!important; bottom:0!important; width:100%!important; z-index:20!important; padding-bottom:env(safe-area-inset-bottom)!important; }
      .new-chat-button { position:fixed!important; right:max(18px,env(safe-area-inset-right))!important; bottom:calc(76px + env(safe-area-inset-bottom))!important; z-index:30!important; }
      @media (prefers-color-scheme:dark) {
        body { background:#101514; }
        #chatList .chat-item { background:#101514!important; border-bottom-color:#242b29!important; }
      }
    `;
    document.head.appendChild(style);
  }

  function restore(uid) {
    const el = list();
    if (!el || !uid) return;
    try {
      const cached = localStorage.getItem(cacheKey(uid));
      if (!cached) return;
      restoring = true;
      el.innerHTML = cached;
      restoring = false;
    } catch { restoring = false; }
  }

  function save(uid) {
    const el = list();
    if (!uid || !el || restoring || !el.children.length) return;
    try { localStorage.setItem(cacheKey(uid), el.innerHTML); } catch {}
  }

  function scheduleSave(uid) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(uid), 350);
  }

  function normalizeRow(row) {
    if (!row) return;

    const info = row.querySelector('.chat-info');
    if (!info) return;

    const time = row.querySelector('.message-time');
    const badge = row.querySelector('.unread-badge');
    const preview = row.querySelector('.chat-bottom p');

    // Always verify the structure. app.js can update a row's innerHTML while keeping
    // the same .chat-item node; relying on a one-time data flag caused the old layout
    // to return after Firebase refresh/resume.
    let right = row.querySelector('.chat-right');
    if (!right) {
      right = document.createElement('div');
      right.className = 'chat-right';
      row.appendChild(right);
    }

    if (time && time.parentElement !== right) right.appendChild(time);

    if (badge) {
      if (badge.parentElement !== right) right.appendChild(badge);
    } else {
      let placeholder = right.querySelector('.unread-placeholder');
      if (!placeholder) {
        placeholder = document.createElement('span');
        placeholder.className = 'unread-placeholder';
        placeholder.setAttribute('aria-hidden', 'true');
        placeholder.textContent = '0';
        right.appendChild(placeholder);
      }
    }

    // Remove stale placeholders if a real unread badge appeared after a Firebase update.
    right.querySelectorAll('.unread-placeholder').forEach(p => {
      if (badge) p.remove();
    });

    if (preview) {
      let previewWrap = row.querySelector('.chat-preview');
      if (!previewWrap) {
        previewWrap = document.createElement('div');
        previewWrap.className = 'chat-preview';
        preview.parentNode.insertBefore(previewWrap, preview);
        previewWrap.appendChild(preview);
      } else if (preview.parentElement !== previewWrap) {
        previewWrap.appendChild(preview);
      }
    }

    row.dataset.whatsappNormalized = '1';
  }

  function normalizeAll() {
    const el = list();
    if (!el) return;
    el.querySelectorAll('.chat-item').forEach(normalizeRow);
    scheduleSave(user()?.uid);
  }

  function installSearch() {
    const button = document.getElementById('chatsSearchButton') || document.querySelector('.header-actions button');
    if (!button || button.dataset.chatSearchInstalled) return;
    button.dataset.chatSearchInstalled = '1';
    button.addEventListener('click', () => {
      const current = list();
      if (!current) return;
      const query = prompt('Search chats');
      if (query === null) return;
      const q = query.trim().toLowerCase();
      current.querySelectorAll('.chat-item').forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = !q || text.includes(q) ? '' : 'none';
      });
    });
  }

  function installTabs() {
    document.querySelectorAll('.chat-tabs button').forEach(button => {
      if (button.dataset.chatTabInstalled) return;
      button.dataset.chatTabInstalled = '1';
      button.addEventListener('click', () => {
        document.querySelectorAll('.chat-tabs button').forEach(b => b.classList.remove('active'));
        button.classList.add('active');
        const mode = button.textContent.trim().toLowerCase();
        list()?.querySelectorAll('.chat-item').forEach(row => {
          row.style.display = mode === 'unread' && !row.classList.contains('unread') ? 'none' : '';
        });
      });
    });
  }

  function installNavigation() {
    document.addEventListener('click', event => {
      const row = event.target.closest?.('#chatList .chat-item');
      if (!row) return;
      const uid = row.dataset.chatUid;
      if (!uid) return;
      localStorage.setItem('currentChatUid', uid);
      const name = row.dataset.name || row.querySelector('.chat-top h3')?.textContent?.trim();
      if (name) localStorage.setItem('currentChatName', name.replace('📌','').trim());
      window.location.href = 'chat.html?chat=' + encodeURIComponent(uid);
    }, true);
  }

  function boot() {
    installCSS();
    const uid = user()?.uid;
    restore(uid);
    // Normalize the restored snapshot immediately. This prevents an older-looking
    // cached row from being visible while Firebase wakes up.
    normalizeAll();
    installSearch();
    installTabs();
    installNavigation();

    const el = list();
    if (!el) return;

    const observer = new MutationObserver(() => {
      if (!restoring) normalizeAll();
    });
    observer.observe(el, { childList:true, subtree:true });

    // iOS Safari/Android resume can restore the document without a normal reload.
    // Re-apply the structure on visibility/pageshow so the cached/pre-Firebase DOM
    // can never win over the WhatsApp layout.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        normalizeAll();
        scheduleSave(uid);
      }
    });
    window.addEventListener('pageshow', () => {
      normalizeAll();
      scheduleSave(uid);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();