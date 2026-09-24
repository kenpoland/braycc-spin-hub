import { getStore } from '@netlify/blobs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Token'
};

const STORE_NAME = 'braycc';

async function loadData() {
  const store = getStore(STORE_NAME);
  const data = await store.get('data', { type: 'json' });
  return data || { spins: [], subscriptions: [] };
}

async function saveData(data) {
  const store = getStore(STORE_NAME);
  await store.setJSON('data', data);
}

export async function handler(event) {
  const method = event.httpMethod;

  if (method === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };

  try {
    const data = await loadData();
    data.spins = data.spins || [];
    data.subscriptions = data.subscriptions || [];

    // ---------- GET all spins ----------
    if (method === 'GET') {
      return {
        statusCode: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body: JSON.stringify({ spins: data.spins })
      };
    }

    // ---------- POST new spin ----------
    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const required = ['title', 'type', 'date', 'time', 'location', 'distance', 'pace', 'author', 'phone'];
      for (const f of required) {
        if (!body[f]) {
          return { statusCode: 400, headers: cors, body: JSON.stringify({ error: `Missing field: ${f}` }) };
        }
      }

      const newSpin = {
        id: 'spin-' + Date.now(),
        title: String(body.title).slice(0, 120),
        type: body.type,
        date: body.date,
        time: body.time,
        location: String(body.location).slice(0, 160),
        distance: parseInt(body.distance, 10) || 0,
        pace: body.pace,
        minRiders: parseInt(body.minRiders, 10) || 3,
        weatherPolicy: body.weatherPolicy,
        mudguardsRequired: !!body.mudguardsRequired,
        author: String(body.author).slice(0, 80),
        phone: String(body.phone).slice(0, 40),
        mapLink: body.mapLink || null,
        committed: [String(body.author).slice(0, 80)],
        interested: [],
        createdAt: new Date().toISOString()
      };

      data.spins.unshift(newSpin);
      await saveData(data);

      // Fire-and-forget push notification
      try {
        const origin = event.headers.origin || `https://${event.headers.host}`;
        await fetch(`${origin}/api/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: process.env.PUSH_SEND_SECRET,
            title: '🚴 New Spin Proposed',
            body: `${newSpin.title} — ${newSpin.date} @ ${newSpin.time}`,
            url: '/'
          })
        });
      } catch (e) {
        console.warn('Push notify failed:', e.message);
      }

      return {
        statusCode: 201,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body: JSON.stringify({ spin: newSpin })
      };
    }

    // ---------- PATCH RSVP ----------
    if (method === 'PATCH') {
      const id = event.queryStringParameters && event.queryStringParameters.id;
      const body = JSON.parse(event.body || '{}');
      const { action, user } = body;
      if (!id || !action || !user) {
        return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'id, action, user required' }) };
      }
      const spin = data.spins.find(s => s.id === id);
      if (!spin) {
        return { statusCode: 404, headers: cors, body: JSON.stringify({ error: 'Spin not found' }) };
      }

      spin.committed = (spin.committed || []).filter(u => u !== user);
      spin.interested = (spin.interested || []).filter(u => u !== user);
      if (action === 'committed') spin.committed.push(user);
      if (action === 'interested') spin.interested.push(user);

      await saveData(data);
      return {
        statusCode: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body: JSON.stringify({ spin })
      };
    }

    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (err) {
    console.error('spins.js error:', err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
}