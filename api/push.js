const webpush = require('web-push');

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const { subscription, data } = req.body || {};
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return json(res, 400, { error: 'Invalid push subscription' });
  }

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json(res, 500, { error: 'Push service is not configured' });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@m3ss3nger.app',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        type: 'incoming_call',
        ...(data || {})
      }),
      {
        TTL: 60,
        urgency: 'high'
      }
    );

    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('WEB PUSH ERROR:', error.statusCode, error.body || error.message);
    return json(res, error.statusCode === 404 || error.statusCode === 410 ? 410 : 502, {
      ok: false,
      error: error.body || error.message || 'Push delivery failed'
    });
  }
};
