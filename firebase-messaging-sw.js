const SW_VERSION = 'm3ss3nger-push-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {
    try { data = JSON.parse(event.data?.text?.() || '{}'); } catch (_) {}
  }
  if (data.data && typeof data.data === 'object') data = { ...data.data, ...data };

  const incoming = data.type === 'incoming_call';
  const title = incoming ? 'Incoming M3ss3nger call' : 'M3ss3nger';
  const body = incoming
    ? `${data.callerName || 'Someone'} is calling`
    : (data.body || 'You have a new notification');

  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: incoming ? `incoming-call-${data.callId || Date.now()}` : `m3ss3nger-${Date.now()}`,
    renotify: true,
    requireInteraction: incoming,
    vibrate: incoming ? [300, 100, 300, 100, 500] : undefined,
    data: {
      type: data.type,
      callId: data.callId || '',
      conversationId: data.conversationId || '',
      callerId: data.callerId || '',
      callerName: data.callerName || 'Contact'
    }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.type === 'incoming_call'
    ? `/chat.html?incomingCall=${encodeURIComponent(data.callId || '')}&conversationId=${encodeURIComponent(data.conversationId || '')}`
    : '/chat.html';

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(w => w.url.includes('/chat.html')) || windows[0];
    if (existing) {
      await existing.navigate(url);
      return existing.focus();
    }
    return clients.openWindow(url);
  })());
});