const webpush = require('web-push');

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_) { return {}; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });

  const body = await readBody(req);
  const subscription = body.subscription;
  const data = body.data || {};

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return json(res, 400, { ok: false, error: 'Invalid push subscription' });
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@m3ss3nger.app';

  if (!publicKey || !privateKey) {
    return json(res, 500, { ok: false, error: 'Push service is not configured' });
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  try {
    await webpush.sendNotification(subscription, JSON.stringify({
      type: data.type || 'incoming_call',
      callerName: data.callerName || 'Someone',
      callId: data.callId || '',
      conversationId: data.conversationId || '',
      body: data.body || 'Incoming call'
    }));
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('WEB PUSH ERROR:', error.statusCode, error.body || error.message);
    if (error.statusCode === 404 || error.statusCode === 410) {
      return json(res, 410, { ok: false, error: 'Push subscription expired' });
    }
    return json(res, 502, { ok: false, error: 'Push delivery failed' });
  }
};
