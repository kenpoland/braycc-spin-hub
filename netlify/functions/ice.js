import { getStore } from '@netlify/blobs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const STORE_NAME = 'braycc';

function normalizeCommitted(arr) {
  return (arr || []).map(c => typeof c === 'string' ? { name: c, ice: null } : c);
}

export default async (req, context) => {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors });
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  const id = url.searchParams.get('id');
  const user = url.searchParams.get('user');
  if (!id || !user) {
    return new Response(JSON.stringify({ error: 'id and user required' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  try {
    const store = getStore(STORE_NAME);
    const data = (await store.get('data', { type: 'json' })) || { spins: [] };
    const spin = (data.spins || []).find(s => s.id === id);
    if (!spin) {
      return new Response(JSON.stringify({ error: 'Spin not found' }), {
        status: 404, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    if (String(spin.author).toLowerCase() !== String(user).toLowerCase()) {
      return new Response(JSON.stringify({ error: 'Not authorised to view ICE contacts for this spin.' }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    const contacts = normalizeCommitted(spin.committed)
      .filter(c => c.ice && c.ice.name && c.ice.phone)
      .map(c => ({
        rider: c.name,
        committedAt: c.committedAt || null,
        ice: c.ice
      }));

    return new Response(JSON.stringify({ contacts }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
};