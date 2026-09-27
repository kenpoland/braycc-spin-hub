import { getStore } from '@netlify/blobs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Token'
};

const STORE_NAME = 'braycc';

/* ============================================================
   CHALLENGE TYPES
   ------------------------------------------------------------
   - 'distance'   → total km in a window (Festive 500)
   - 'monthly'    → one qualifying ride per month for 12 months (RRTY)
   ============================================================ */

/* ============================================================
   DEFAULT SEED CHALLENGES
   ------------------------------------------------------------
   These are only inserted the first time the app runs.
   Edit them here and delete the existing challenges in admin
   to re-seed, or edit them directly in admin.
   ============================================================ */
const SEED_CHALLENGES = [
  {
    id: 'challenge-festive-500-2026',
    slug: 'festive-500-2026',
    title: 'Festive 500 — 2026',
    org: 'Rapha',
    type: 'distance',
    windowStart: '2026-12-24',
    windowEnd: '2026-12-31',
    targetKm: 500,
    unit: 'km',
    description: 'Ride 500 km in the 8 days between Christmas Eve and New Year\'s Eve.',
    rules: [
      'Ride 500 km between 24th and 31st December 2026.',
      'Any riding counts — road, gravel, MTB, virtual (Zwift, etc.).',
      'Log your distances here to track progress with the club.',
      'Claim your roundel from Rapha (or your local clubhouse) once complete.'
    ],
    link: 'https://www.rapha.cc/ca/en/story/festive500',
    badgeColor: 'red',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'seed'
  },
  {
    id: 'challenge-rrty-100',
    slug: 'rrty-100',
    title: 'Randonneur Round the Year 100',
    org: 'Audax Ireland',
    type: 'monthly',
    windowStart: null,
    windowEnd: null,
    ridesRequired: 12,
    minDistancePerRide: 100,
    unit: 'km',
    description: 'Complete one approved Audax brevet of at least 100 km in each of 12 consecutive months.',
    rules: [
      'Complete one approved brevet of at least 100 km each month for 12 consecutive months.',
      'Qualifying events: Audax Ireland Calendar events, Permanents ≥100km, or Audax events in other countries.',
      'You can start in any month — you then have 12 consecutive months to complete all rides.',
      'The same event can be ridden for multiple months — you don\'t need a different one each month.',
      'If you miss a month, you must start again (unless official dispensation is given).',
      'A valid Cycling Ireland licence is required.',
      'Claim the award within 2 years of completion — RRTY medal is free on request.'
    ],
    link: 'https://www.audaxireland.org/audax/awards-medals/rrty-100/',
    badgeColor: 'purple',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'seed'
  },
  {
    id: 'challenge-rrty-200',
    slug: 'rrty-200',
    title: 'Randonneur Round the Year 200',
    org: 'Audax Ireland',
    type: 'monthly',
    windowStart: null,
    windowEnd: null,
    ridesRequired: 12,
    minDistancePerRide: 200,
    unit: 'km',
    description: 'The classic RRTY — complete one approved brevet of at least 200 km each month for 12 consecutive months.',
    rules: [
      'Complete one approved brevet of at least 200 km each month for 12 consecutive months.',
      'Qualifying events: Audax Ireland Calendar events, Permanents ≥200km, or Audax events in other countries.',
      'You can start in any month — you then have 12 consecutive months to complete all rides.',
      'The same event can be ridden for multiple months — you don\'t need a different one each month.',
      'If you miss a month, you must start again (unless official dispensation is given).',
      'A valid Cycling Ireland licence is required.'
    ],
    link: 'https://www.audaxireland.org/audax/awards-medals/',
    badgeColor: 'blue',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'seed'
  }
];

async function loadData() {
  const store = getStore(STORE_NAME);
  const data = await store.get('data', { type: 'json' });
  return data || { spins: [], subscriptions: [], challenges: [], challengeEntries: [] };
}
async function saveData(data) {
  const store = getStore(STORE_NAME);
  await store.setJSON('data', data);
}

// Ensure challenges array exists and seed defaults on very first run
function ensureSeeded(data) {
  data.challenges = data.challenges || [];
  data.challengeEntries = data.challengeEntries || [];
  let seeded = false;
  if (data.challenges.length === 0) {
    data.challenges = SEED_CHALLENGES.map(c => ({ ...c }));
    seeded = true;
  }
  return seeded;
}

/* ============================================================
   Normalise an entry record
   ============================================================ */
function normaliseEntry(entry) {
  return {
    id: entry.id,
    challengeId: entry.challengeId,
    memberName: entry.memberName,
    joinedAt: entry.joinedAt || new Date().toISOString(),
    // distance challenges
    totalKm: entry.totalKm || 0,
    activities: entry.activities || [],   // [{ id, date, km, note, loggedAt }]
    // monthly challenges
    rides: entry.rides || [],             // [{ id, month: 'YYYY-MM', distance, note, loggedAt }]
    notes: entry.notes || ''
  };
}

/* ============================================================
   HANDLER
   ============================================================ */
export default async (req, context) => {
  const method = req.method;
  const url = new URL(req.url);

  if (method === 'OPTIONS') return new Response('', { status: 204, headers: cors });

  try {
    const data = await loadData();
    if (ensureSeeded(data)) await saveData(data);

    /* ---------- GET: list challenges ---------- */
    if (method === 'GET' && !url.searchParams.get('id')) {
      // Public summary
      const publicChallenges = data.challenges
        .filter(c => c.active !== false)
        .map(c => ({
          id: c.id,
          slug: c.slug,
          title: c.title,
          org: c.org,
          type: c.type,
          windowStart: c.windowStart,
          windowEnd: c.windowEnd,
          targetKm: c.targetKm || null,
          ridesRequired: c.ridesRequired || null,
          minDistancePerRide: c.minDistancePerRide || null,
          unit: c.unit || 'km',
          description: c.description,
          badgeColor: c.badgeColor || 'purple'
        }));
      return new Response(JSON.stringify({ challenges: publicChallenges }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    /* ---------- GET single challenge + its entries ---------- */
    if (method === 'GET' && url.searchParams.get('id')) {
      const id = url.searchParams.get('id');
      const challenge = data.challenges.find(c => c.id === id || c.slug === id);
      if (!challenge) {
        return new Response(JSON.stringify({ error: 'Challenge not found' }), {
          status: 404, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
      const entries = data.challengeEntries
        .filter(e => e.challengeId === challenge.id)
        .map(normaliseEntry);
      return new Response(JSON.stringify({ challenge, entries }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    /* ---------- POST: join a challenge ---------- */
    if (method === 'POST' && url.searchParams.get('action') === 'join') {
      const body = await req.json();
      const { challengeId, memberName } = body;
      if (!challengeId || !memberName) {
        return new Response(JSON.stringify({ error: 'challengeId and memberName required' }), {
          status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
      const challenge = data.challenges.find(c => c.id === challengeId);
      if (!challenge) {
        return new Response(JSON.stringify({ error: 'Challenge not found' }), {
          status: 404, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }

      const existing = data.challengeEntries.find(e =>
        e.challengeId === challengeId &&
        String(e.memberName).toLowerCase() === String(memberName).toLowerCase()
      );
      if (existing) {
        return new Response(JSON.stringify({ entry: normaliseEntry(existing), alreadyJoined: true }), {
          status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }

      const entry = {
        id: 'entry-' + Date.now(),
        challengeId,
        memberName: String(memberName).slice(0, 80),
        joinedAt: new Date().toISOString(),
        totalKm: 0,
        activities: [],
        rides: [],
        notes: ''
      };
      data.challengeEntries.push(entry);
      await saveData(data);
      return new Response(JSON.stringify({ entry: normaliseEntry(entry) }), {
        status: 201, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    /* ---------- POST: log an activity (distance) ---------- */
    if (method === 'POST' && url.searchParams.get('action') === 'log-distance') {
      const body = await req.json();
      const { challengeId, memberName, km, date, note } = body;
      if (!challengeId || !memberName || !km) {
        return new Response(JSON.stringify({ error: 'challengeId, memberName, km required' }), {
          status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
      const entry = data.challengeEntries.find(e =>
        e.challengeId === challengeId &&
        String(e.memberName).toLowerCase() === String(memberName).toLowerCase()
      );
      if (!entry) {
        return new Response(JSON.stringify({ error: 'You have not joined this challenge' }), {
          status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
      const act = {
        id: 'act-' + Date.now(),
        date: date || new Date().toISOString().slice(0, 10),
        km: Number(km) || 0,
        note: note ? String(note).slice(0, 200) : '',
        loggedAt: new Date().toISOString()
      };
      entry.activities = entry.activities || [];
      entry.activities.push(act);
      entry.totalKm = entry.activities.reduce((sum, a) => sum + (Number(a.km) || 0), 0);
      await saveData(data);
      return new Response(JSON.stringify({ entry: normaliseEntry(entry) }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    /* ---------- POST: log a monthly ride (RRTY) ---------- */
    if (method === 'POST' && url.searchParams.get('action') === 'log-ride') {
      const body = await req.json();
      const { challengeId, memberName, month, distance, note } = body;
      if (!challengeId || !memberName || !month || !distance) {
        return new Response(JSON.stringify({ error: 'challengeId, memberName, month, distance required' }), {
          status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
      const challenge = data.challenges.find(c => c.id === challengeId);
      if (!challenge || challenge.type !== 'monthly') {
        return new Response(JSON.stringify({ error: 'Not a monthly challenge' }), {
          status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
      if (Number(distance) < (challenge.minDistancePerRide || 0)) {
        return new Response(JSON.stringify({
          error: `Ride must be at least ${challenge.minDistancePerRide} km`
        }), {
          status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }

      const entry = data.challengeEntries.find(e =>
        e.challengeId === challengeId &&
        String(e.memberName).toLowerCase() === String(memberName).toLowerCase()
      );
      if (!entry) {
        return new Response(JSON.stringify({ error: 'You have not joined this challenge' }), {
          status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
      // Only one ride per month
      entry.rides = (entry.rides || []).filter(r => r.month !== month);
      entry.rides.push({
        id: 'ride-' + Date.now(),
        month,
        distance: Number(distance),
        note: note ? String(note).slice(0, 200) : '',
        loggedAt: new Date().toISOString()
      });
      await saveData(data);
      return new Response(JSON.stringify({ entry: normaliseEntry(entry) }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    /* ---------- DELETE: unjoin / remove activity / remove ride ---------- */
    if (method === 'DELETE') {
      const challengeId = url.searchParams.get('challengeId');
      const memberName = url.searchParams.get('memberName');
      const activityId = url.searchParams.get('activityId');
      const rideMonth = url.searchParams.get('rideMonth');
      if (!challengeId || !memberName) {
        return new Response(JSON.stringify({ error: 'challengeId and memberName required' }), {
          status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
      const idx = data.challengeEntries.findIndex(e =>
        e.challengeId === challengeId &&
        String(e.memberName).toLowerCase() === String(memberName).toLowerCase()
      );
      if (idx === -1) {
        return new Response(JSON.stringify({ error: 'Entry not found' }), {
          status: 404, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
      const entry = data.challengeEntries[idx];

      // Delete a specific activity
      if (activityId) {
        entry.activities = (entry.activities || []).filter(a => a.id !== activityId);
        entry.totalKm = entry.activities.reduce((sum, a) => sum + (Number(a.km) || 0), 0);
        await saveData(data);
        return new Response(JSON.stringify({ entry: normaliseEntry(entry) }), {
          status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }

      // Delete a specific monthly ride
      if (rideMonth) {
        entry.rides = (entry.rides || []).filter(r => r.month !== rideMonth);
        await saveData(data);
        return new Response(JSON.stringify({ entry: normaliseEntry(entry) }), {
          status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }

      // Otherwise: leave the challenge entirely
      data.challengeEntries.splice(idx, 1);
      await saveData(data);
      return new Response(JSON.stringify({ ok: true, left: true }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    /* ---------- ADMIN: create / update / delete challenge ---------- */
    if (method === 'PATCH' || (method === 'POST' && url.searchParams.get('action') === 'admin-upsert')) {
      const adminToken = req.headers.get('x-admin-token');
      if (adminToken !== process.env.ADMIN_TOKEN_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
      const body = await req.json();
      const incoming = body.challenge;
      if (!incoming) {
        return new Response(JSON.stringify({ error: 'challenge required' }), {
          status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }

      if (incoming.id) {
        const idx = data.challenges.findIndex(c => c.id === incoming.id);
        if (idx === -1) {
          return new Response(JSON.stringify({ error: 'Challenge not found' }), {
            status: 404, headers: { ...cors, 'Content-Type': 'application/json' }
          });
        }
        data.challenges[idx] = { ...data.challenges[idx], ...incoming };
        await saveData(data);
        return new Response(JSON.stringify({ challenge: data.challenges[idx] }), {
          status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      } else {
        const newChal = {
          ...incoming,
          id: 'challenge-' + Date.now(),
          slug: incoming.slug || 'challenge-' + Date.now(),
          createdAt: new Date().toISOString()
        };
        data.challenges.push(newChal);
        await saveData(data);
        return new Response(JSON.stringify({ challenge: newChal }), {
          status: 201, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('challenges.js error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
};