const SW_VERSION='m3ss3nger-push-v9';
const APP_CACHE='me-and-you-app-v1';
const APP_SHELL=['/login.html','/manifest.json'];

self.addEventListener('install',event=>{event.waitUntil(caches.open(APP_CACHE).then(cache=>cache.addAll(APP_SHELL)).catch(()=>{}).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)))});

self.addEventListener('push',event=>{
 let data={};
 try{data=event.data?event.data.json():{}}catch(_){try{data=JSON.parse(event.data?.text?.()||'{}')}catch(_){}
 }
 const type=data.type;
 if(type!=='new_message'&&type!=='incoming_call')return;
 const incoming=type==='incoming_call';
 const conversationId=data.conversationId||'';
 const messageId=data.messageId||'';
 const callId=data.callId||'';
 const senderName=data.senderName||data.callerName||'Contact';
 // Keep one visible notification per chat while still alerting for every new message.
 // This prevents iOS from building huge stacks such as “60 notifications from Me And You”.
 const tag=incoming?`call-${callId||Date.now()}`:`chat-${conversationId||senderName}`;
 const title=incoming?senderName:senderName;
 const body=incoming?'Incoming call':(data.body||'New message');
 event.waitUntil(self.registration.showNotification(title,{body,icon:'/Img_9610(1).png',badge:'/Img_9610(1).png',tag,renotify:!incoming,requireInteraction:incoming,vibrate:incoming?[300,100,300,100,500]:[200],data:{type,conversationId,messageId,callId,callerId:data.callerId||'',callerName:data.callerName||senderName}}));
});

self.addEventListener('notificationclick',event=>{event.notification.close();const data=event.notification.data||{};const url=data.type==='incoming_call'?`/?incomingCall=${encodeURIComponent(data.callId||'')}&conversationId=${encodeURIComponent(data.conversationId||'')}`:`/?conversationId=${encodeURIComponent(data.conversationId||'')}`;event.waitUntil((async()=>{const windows=await clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows){if('focus'in client){try{await client.focus();if('navigate'in client)await client.navigate(url);return}catch(_){}}}if(clients.openWindow)return clients.openWindow(url)})())});
