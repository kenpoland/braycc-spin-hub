import { getStore } from '@netlify/blobs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const STORE_NAME = 'braycc';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const sub = JSON.parse(event.body || '{}');
    if (!sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid subscription' }) };
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

    return {
      statusCode: 201,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, count: data.subscriptions.length })
    };
  } catch (err) {
    console.error('subscribe.js error:', err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
}