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
    spin.committed.forEach(c => { if (c.ice) { c.ice = null; changed = true; } });
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
    })),
    interested: (spin.interested || []).map(i =>
      typeof i === 'string' ? { name: i } : { name: i.name }
    )
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

    // ---------- GET ----------
    if (method === 'GET') {
      return new Response(JSON.stringify({ spins: data.spins.map(sanitizeSpin) }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    // ---------- POST (create spin) ----------
    if (method === 'POST') {
      const body = await req.json();
      const required = ['title', 'type', 'date', 'time', 'location', 'distance', 'pace', 'author', 'phone'];
      for (const f of required) {
        if (!body[f]) {
          return new Response(JSON.stringify({ error: `Missing field: ${f}` }), {
            status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
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
        status: 201, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    // ---------- PATCH (RSVP + proposer edit) ----------
    if (method === 'PATCH') {
      const id = url.searchParams.get('id');
      const body = await req.json();

      // --- Proposer edit path (when 'author' is in body and matches) ---
      if (body._edit && body.author) {
        const idx = data.spins.findIndex(s => s.id === id);
        if (idx === -1) {
          return new Response(JSON.stringify({ error: 'Spin not found' }), {
            status: 404, headers: { ...cors, 'Content-Type': 'application/json' }
          });
        }
        const spin = data.spins[idx];
        const requester = String(body._requester || body.author).toLowerCase();
        const isAuthor = String(spin.author).toLowerCase() === requester;
        const isAdmin = req.headers.get('x-admin-token') === process.env.ADMIN_TOKEN_SECRET;
        if (!isAuthor && !isAdmin) {
          return new Response(JSON.stringify({ error: 'Not authorised to edit this spin' }), {
            status: 403, headers: { ...cors, 'Content-Type': 'application/json' }
          });
        }

        const editable = ['title','type','date','time','location','distance','pace','minRiders','weatherPolicy','mudguardsRequired','phone','mapLink'];
        editable.forEach(k => { if (body[k] !== undefined) spin[k] = body[k]; });

        await saveData(data);
        return new Response(JSON.stringify({ spin: sanitizeSpin(spin) }), {
          status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }

      // --- Normal RSVP path ---
    
       const { action, user, ice, phone } = body;

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
      spin.interested = (spin.interested || []).map(i =>
        typeof i === 'string' ? { name: i, phone: '' } : i
      );
      spin.committed = spin.committed.filter(c => c.name !== user);
      spin.interested = spin.interested.filter(u => u.name !== user);

          if (action === 'committed') {
        if (!phone) {
          return new Response(JSON.stringify({
            error: 'Your phone number is required to commit.'
          }), {
            status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
          });
        }
        if (!ice || !ice.name || !ice.phone) {
          return new Response(JSON.stringify({
            error: 'ICE contact (name and phone) is required to commit.'
          }), {
            status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
          });
        }
        spin.committed.push({
          name: user,
          phone: String(phone).slice(0, 40),
          committedAt: new Date().toISOString(),
          ice: {
            name: String(ice.name).slice(0, 80),
            phone: String(ice.phone).slice(0, 40),
            relation: ice.relation ? String(ice.relation).slice(0, 40) : '',
            notes: ice.notes ? String(ice.notes).slice(0, 300) : ''
          }
        });
      }
      if (action === 'interested') {
        if (!phone) {
          return new Response(JSON.stringify({
            error: 'Your phone number is required to mark interest.'
          }), {
            status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
          });
        }
        spin.interested.push({ name: user, phone: String(phone).slice(0, 40) });
      }

      await saveData(data);
      return new Response(JSON.stringify({ spin: sanitizeSpin(spin) }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    // ---------- DELETE (proposer cancels own spin, or admin) ----------
    if (method === 'DELETE') {
      const id = url.searchParams.get('id');
      const requester = url.searchParams.get('user');
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
      const spin = data.spins[idx];
      const isAdmin = req.headers.get('x-admin-token') === process.env.ADMIN_TOKEN_SECRET;
      const isAuthor = requester && String(spin.author).toLowerCase() === String(requester).toLowerCase();

      if (!isAuthor && !isAdmin) {
        return new Response(JSON.stringify({ error: 'Not authorised to cancel this spin' }), {
          status: 403, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }

      const cancelledTitle = spin.title;
      const cancelledDate = spin.date;
      const cancelledTime = spin.time;

      data.spins.splice(idx, 1);
      await saveData(data);

      // Fire-and-forget push notification
      try {
        await fetch(`${url.origin}/api/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: process.env.PUSH_SEND_SECRET,
            title: '❌ Spin Cancelled',
            body: `${cancelledTitle} on ${cancelledDate} @ ${cancelledTime} has been cancelled.`,
            url: '/'
          })
        });
      } catch (e) { console.warn('Push cancel notify failed:', e.message); }

      return new Response(JSON.stringify({ ok: true, cancelled: id }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
    // ---------- GET WhatsApp group list (proposer only) ----------
    if (method === 'GET' && url.searchParams.get('waGroup') === '1') {
      const id = url.searchParams.get('id');
      const requester = url.searchParams.get('user');
      if (!id || !requester) {
        return new Response(JSON.stringify({ error: 'id and user required' }), {
          status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
      const spin = data.spins.find(s => s.id === id);
      if (!spin) {
        return new Response(JSON.stringify({ error: 'Spin not found' }), {
          status: 404, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
      if (String(spin.author).toLowerCase() !== String(requester).toLowerCase()) {
        return new Response(JSON.stringify({ error: 'Only the proposer can view this list' }), {
          status: 403, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }

      const committed = normalizeCommitted(spin.committed);
      const interested = (spin.interested || []).map(i =>
        typeof i === 'string' ? { name: i, phone: '' } : i
      );

      const contacts = [
        ...committed.map(c => ({ name: c.name, phone: c.phone || '', status: 'Committed' })),
        ...interested.map(i => ({ name: i.name, phone: i.phone || '', status: 'Interested' }))
      ].filter(c => c.phone);

      // Suggested message for the group
      const dateObj = new Date(spin.date + 'T' + (spin.time || '09:00'));
      const dateStr = dateObj.toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' });
      const suggestedMessage =
`🚴 ${spin.title}
📅 ${dateStr} at ${spin.time}
📍 ${spin.location}
🏁 ${spin.distance} km · ${spin.pace} pace
${spin.mapLink ? '🗺️ ' + spin.mapLink : ''}`;

      return new Response(JSON.stringify({ contacts, suggestedMessage }), {
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