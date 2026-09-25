import { getStore } from '@netlify/blobs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
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

async function loadData() {
  const store = getStore(STORE_NAME);
  const data = await store.get('data', { type: 'json' });
  return data || { spins: [], subscriptions: [] };
}
async function saveData(data) {
  const store = getStore(STORE_NAME);
  await store.setJSON('data', data);
}

function checkAuth(req) {
  const token = req.headers.get('x-admin-token');
  return token && token === process.env.ADMIN_TOKEN_SECRET;
}

export default async (req, context) => {
  const method = req.method;
  const url = new URL(req.url);

  if (method === 'OPTIONS') return new Response('', { status: 204, headers: cors });

  if (!checkAuth(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  try {
    const data = await loadData();
    data.spins = data.spins || [];
    data.subscriptions = data.subscriptions || [];

    if (method === 'GET') {
      const spins = data.spins.map(spin => ({
        ...spin,
        committed: normalizeCommitted(spin.committed)
      }));
      return new Response(JSON.stringify({ spins, subscriptions: data.subscriptions }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    if (method === 'PATCH') {
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ error: 'id required' }), {
          status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
      const idx = data.spins.findIndex(s => s.id === id);
      if (idx === -1) {
        return new Response(JSON.stringify({ error: 'Spin not found' }), {
          status: 404, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
      const body = await req.json();
      const spin = data.spins[idx];
      const editable = ['title','type','date','time','location','distance','pace','minRiders','weatherPolicy','mudguardsRequired','author','phone','mapLink'];
      editable.forEach(k => { if (body[k] !== undefined) spin[k] = body[k]; });
      if (Array.isArray(body.committed)) spin.committed = normalizeCommitted(body.committed);
      if (Array.isArray(body.interested)) spin.interested = body.interested;

      await saveData(data);
      return new Response(JSON.stringify({ spin }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    if (method === 'DELETE') {
      const id = url.searchParams.get('id');
      const rider = url.searchParams.get('rider');
      if (!id) {
        return new Response(JSON.stringify({ error: 'id required' }), {
          status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
      const idx = data.spins.findIndex(s => s.id === id);
      if (idx === -1) {
        return new Response(JSON.stringify({ error: 'Spin not found' }), {
          status: 404, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }

      if (rider) {
        const spin = data.spins[idx];
        spin.committed = normalizeCommitted(spin.committed).filter(c => c.name !== rider);
        spin.interested = (spin.interested || []).filter(n => n !== rider);
        await saveData(data);
        return new Response(JSON.stringify({ spin }), {
          status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }

      const removed = data.spins.splice(idx, 1)[0];
      await saveData(data);
      return new Response(JSON.stringify({ removed: removed.id }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('admin.js error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
};