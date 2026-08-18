const SW_VERSION='m3ss3nger-push-v7';
const APP_CACHE='me-and-you-app-v1';
const APP_SHELL=['/login.html','/manifest.json'];

self.addEventListener('install',event=>{event.waitUntil(caches.open(APP_CACHE).then(cache=>cache.addAll(APP_SHELL)).catch(()=>{}).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)))});

self.addEventListener('push',event=>{
 let data={};
 try{data=event.data?event.data.json():{}}catch(_){try{data=JSON.parse(event.data?.text?.()||'{}')}catch(_){}
 }
 if(data.type!=='incoming_call'&&data.type!=='new_message')return;
 const incoming=data.type==='incoming_call';
 const conversationId=data.conversationId||'';
 const messageId=data.messageId||'';
 const tag=incoming?`incoming-call-${data.callId||Date.now()}`:`message-${conversationId}-${messageId||'latest'}`;
 const title=incoming?'Incoming M3ss3nger call':(data.senderName||'M3ss3nger');
 const body=incoming?`${data.callerName||'Someone'} is calling`:(data.body||'You have a new message');
 event.waitUntil(self.registration.showNotification(title,{body,icon:'/Img_9610(1).png',badge:'/Img_9610(1).png',tag,renotify:false,requireInteraction:incoming,vibrate:incoming?[300,100,300,100,500]:[200],data:{type:data.type,conversationId,messageId,callId:data.callId||'',callerId:data.callerId||'',callerName:data.callerName||'Contact'}}));
});

self.addEventListener('notificationclick',event=>{event.notification.close();const data=event.notification.data||{};const url=data.type==='incoming_call'?`/?incomingCall=${encodeURIComponent(data.callId||'')}&conversationId=${encodeURIComponent(data.conversationId||'')}`:`/?conversationId=${encodeURIComponent(data.conversationId||'')}`;event.waitUntil((async()=>{const windows=await clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows){if('focus'in client){try{await client.focus();if('navigate'in client)await client.navigate(url);return}catch(_){}}}if(clients.openWindow)return clients.openWindow(url)})())});
