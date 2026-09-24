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

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { secret, title, body, url } = await req.json();
    if (secret !== process.env.PUSH_SEND_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
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

    return new Response(JSON.stringify({
      sent: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
      total: subs.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('push.js error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};