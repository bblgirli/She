importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBzuctjdTAHT3kxdrIZz9aGe5mGLsiGwx4',
  authDomain: 'm3ss3nger-50a21.firebaseapp.com',
  projectId: 'm3ss3nger-50a21',
  storageBucket: 'm3ss3nger-50a21.appspot.com',
  messagingSenderId: '245814154474',
  appId: '1:245814154474:web:0d59fafb4b03baa296f393'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title = data.type === 'incoming_call' ? 'Incoming M3ss3nger call' : (payload.notification?.title || 'M3ss3nger');
  const options = {
    body: data.type === 'incoming_call' ? `${data.callerName || 'Someone'} is calling` : (payload.notification?.body || ''),
    icon: '/favicon.svg',
    tag: data.type === 'incoming_call' ? `incoming-call-${data.callId || 'call'}` : 'm3ss3nger',
    requireInteraction: data.type === 'incoming_call',
    data: { ...data }
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.type === 'incoming_call' ? `/chat.html?conversationId=${encodeURIComponent(data.conversationId || '')}&incomingCall=${encodeURIComponent(data.callId || '')}` : '/chat.html';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((w) => 'focus' in w);
    if (existing) return existing.navigate(url).then((w) => w.focus());
    return clients.openWindow(url);
  }));
});
