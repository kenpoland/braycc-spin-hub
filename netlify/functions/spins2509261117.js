import { getStore } from '@netlify/blobs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Token'
};

const STORE_NAME = 'braycc';

function normalizeCommitted(arr) {
  return (arr || []).map(c =>
    typeof c === 'string'
      ? { name: c, ice: null, committedAt: null }
      : { name: c.name, ice: c.ice || null, committedAt: c.committedAt || null }
  );
}

function spinDateTimeMs(spin) {
  if (!spin || !spin.date) return null;
  const t = spin.time || '00:00';
  const d = new Date(`${spin.date}T${t}:00`);
  return isNaN(d.getTime()) ? null : d.getTime();
}

function purgeExpiredICE(spins) {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  let changed = false;
  spins.forEach(spin => {
    const dt = spinDateTimeMs(spin);
    if (dt === null) return;
    if (now - dt < DAY) return;
    spin.committed = normalizeCommitted(spin.committed);
    spin.committed.forEach(c => {
      if (c.ice) { c.ice = null; changed = true; }
    });
  });
  return changed;
}

function sanitizeSpin(spin) {
  return {
    ...spin,
    committed: normalizeCommitted(spin.committed).map(c => ({
      name: c.name,
      committedAt: c.committedAt,
      hasICE: !!(c.ice && c.ice.name && c.ice.phone)
    }))
  };
}

async function loadData() {
  const store = getStore(STORE_NAME);
  const data = await store.get('data', { type: 'json' });
  return data || { spins: [], subscriptions: [] };
}

async function saveData(data) {
  const store = getStore(STORE_NAME);
  await store.setJSON('data', data);
}

export default async (req, context) => {
  const method = req.method;
  const url = new URL(req.url);

  if (method === 'OPTIONS') return new Response('', { status: 204, headers: cors });

  try {
    const data = await loadData();
    data.spins = data.spins || [];
    data.subscriptions = data.subscriptions || [];

    if (purgeExpiredICE(data.spins)) await saveData(data);

    if (method === 'GET') {
      return new Response(JSON.stringify({ spins: data.spins.map(sanitizeSpin) }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    if (method === 'POST') {
      const body = await req.json();
      const required = ['title', 'type', 'date', 'time', 'location', 'distance', 'pace', 'author', 'phone'];
      for (const f of required) {
        if (!body[f]) {
          return new Response(JSON.stringify({ error: `Missing field: ${f}` }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' }
          });
        }
      }

      const author = String(body.author).slice(0, 80);
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
        author,
        phone: String(body.phone).slice(0, 40),
        mapLink: body.mapLink || null,
        committed: [{ name: author, ice: null, committedAt: new Date().toISOString() }],
        interested: [],
        createdAt: new Date().toISOString()
      };

      data.spins.unshift(newSpin);
      await saveData(data);

      try {
        await fetch(`${url.origin}/api/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: process.env.PUSH_SEND_SECRET,
            title: '🚴 New Spin Proposed',
            body: `${newSpin.title} — ${newSpin.date} @ ${newSpin.time}`,
            url: '/'
          })
        });
      } catch (e) { console.warn('Push notify failed:', e.message); }

      return new Response(JSON.stringify({ spin: sanitizeSpin(newSpin) }), {
        status: 201,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    if (method === 'PATCH') {
      const id = url.searchParams.get('id');
      const body = await req.json();
      const { action, user, ice } = body;

      if (!id || !action || !user) {
        return new Response(JSON.stringify({ error: 'id, action, user required' }), {
          status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
      const spin = data.spins.find(s => s.id === id);
      if (!spin) {
        return new Response(JSON.stringify({ error: 'Spin not found' }), {
          status: 404, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }

      spin.committed = normalizeCommitted(spin.committed);
      spin.interested = spin.interested || [];
      spin.committed = spin.committed.filter(c => c.name !== user);
      spin.interested = spin.interested.filter(u => u !== user);

      if (action === 'committed') {
        if (!ice || !ice.name || !ice.phone) {
          return new Response(JSON.stringify({
            error: 'ICE contact (name and phone) is required to commit.'
          }), {
            status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
          });
        }
        spin.committed.push({
          name: user,
          committedAt: new Date().toISOString(),
          ice: {
            name: String(ice.name).slice(0, 80),
            phone: String(ice.phone).slice(0, 40),
            relation: ice.relation ? String(ice.relation).slice(0, 40) : '',
            notes: ice.notes ? String(ice.notes).slice(0, 300) : ''
          }
        });
      }
      if (action === 'interested') spin.interested.push(user);

      await saveData(data);
      return new Response(JSON.stringify({ spin: sanitizeSpin(spin) }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('spins.js error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
};