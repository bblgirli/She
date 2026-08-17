self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const title = data.type === 'incoming_call' ? 'Incoming M3ss3nger call' : 'M3ss3nger';
  const body = data.type === 'incoming_call' ? `${data.callerName || 'Someone'} is calling` : (data.body || 'You have a new notification');
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: data.type === 'incoming_call' ? `incoming-call-${data.callId || 'call'}` : 'm3ss3nger',
    requireInteraction: data.type === 'incoming_call',
    data
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.type === 'incoming_call'
    ? `/chat.html?conversationId=${encodeURIComponent(data.conversationId || '')}&incomingCall=${encodeURIComponent(data.callId || '')}`
    : '/chat.html';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((w) => 'focus' in w);
    if (existing) return existing.navigate(url).then((w) => w.focus());
    return clients.openWindow(url);
  }));
});
