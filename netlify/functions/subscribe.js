import { getStore } from '@netlify/blobs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const STORE_NAME = 'braycc';

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: cors });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  try {
    const sub = await req.json();
    if (!sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
      return new Response(JSON.stringify({ error: 'Invalid subscription' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    const store = getStore(STORE_NAME);
    const data = (await store.get('data', { type: 'json' })) || { spins: [], subscriptions: [] };
    data.subscriptions = data.subscriptions || [];

    if (!data.subscriptions.some(s => s.endpoint === sub.endpoint)) {
      data.subscriptions.push({
        endpoint: sub.endpoint,
        keys: sub.keys,
        addedAt: new Date().toISOString()
      });
      await store.setJSON('data', data);
    }

    return new Response(JSON.stringify({ ok: true, count: data.subscriptions.length }), {
      status: 201,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('subscribe.js error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
};