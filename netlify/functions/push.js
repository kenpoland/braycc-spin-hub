import webpush from 'web-push';
import { getStore } from '@netlify/blobs';

let vapidReady = false;
function initVapid() {
  if (vapidReady) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@braycc.ie',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  vapidReady = true;
}

const STORE_NAME = 'braycc';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { secret, title, body, url } = JSON.parse(event.body || '{}');
    if (secret !== process.env.PUSH_SEND_SECRET) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    initVapid();

    const store = getStore(STORE_NAME);
    const data = (await store.get('data', { type: 'json' })) || { spins: [], subscriptions: [] };
    const subs = data.subscriptions || [];

    const payload = JSON.stringify({
      title: title || 'BrayCC',
      body: body || 'New spin update',
      url: url || '/'
    });

    const results = await Promise.allSettled(
      subs.map(s => webpush.sendNotification(s, payload))
    );

    // Prune dead subscriptions (410 Gone / 404 Not Found)
    const alive = subs.filter((_, i) => {
      const res = results[i];
      if (res.status === 'rejected') {
        const code = res.reason && res.reason.statusCode;
        return code !== 410 && code !== 404;
      }
      return true;
    });

    if (alive.length !== subs.length) {
      data.subscriptions = alive;
      await store.setJSON('data', data);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        sent: results.filter(r => r.status === 'fulfilled').length,
        failed: results.filter(r => r.status === 'rejected').length,
        total: subs.length
      })
    };
  } catch (err) {
    console.error('push.js error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}