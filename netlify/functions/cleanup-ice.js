import { getStore } from '@netlify/blobs';

const STORE_NAME = 'braycc';
const DAY = 24 * 60 * 60 * 1000;

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

export default async (req, context) => {
  try {
    const store = getStore(STORE_NAME);
    const data = (await store.get('data', { type: 'json' })) || { spins: [], subscriptions: [] };
    data.spins = data.spins || [];

    const now = Date.now();
    let purgedCount = 0;

    data.spins.forEach(spin => {
      const dt = spinDateTimeMs(spin);
      if (dt === null) return;
      if (now - dt < DAY) return;
      spin.committed = normalizeCommitted(spin.committed);
      spin.committed.forEach(c => { if (c.ice) { c.ice = null; purgedCount++; } });
    });

    await store.setJSON('data', data);

    return new Response(JSON.stringify({ ok: true, purged: purgedCount, ranAt: new Date().toISOString() }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('cleanup-ice error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = { schedule: '0 3 * * *' };