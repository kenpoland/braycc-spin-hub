import { getStore } from '@netlify/blobs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const RWGPS_API_KEY = process.env.RWGPS_API_KEY;

export default async (req, context) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors });
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  if (String(process.env.FEATURE_RWGPS || '').toLowerCase() !== 'true') {
    return new Response(JSON.stringify({ error: 'Ride with GPS integration is disabled.' }), {
      status: 503, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(req.url);
  const startDate = url.searchParams.get('start');
  const endDate = url.searchParams.get('end');
  if (!startDate || !endDate) {
    return new Response(JSON.stringify({ error: 'start and end dates required (YYYY-MM-DD)' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  try {
    const store = getStore('braycc');
    const data = (await store.get('data', { type: 'json' })) || { rwgpsLinks: [] };
    const links = data.rwgpsLinks || [];

    if (links.length === 0) {
      return new Response(JSON.stringify({ members: [] }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    const results = await Promise.allSettled(links.map(async (link) => {
      const r = await fetch(
        `https://ridewithgps.com/users/${link.rwgpsUserId}/trips.json?apikey=${RWGPS_API_KEY}&auth_token=${link.authToken}&version=2&page=1&page_size=100`
      );

      if (r.status === 401) {
        throw new Error(`TOKEN_EXPIRED:${link.memberName}`);
      }
      if (!r.ok) {
        throw new Error(`HTTP ${r.status} for ${link.memberName}`);
      }

      const json = await r.json();
      const trips = json.trips || json.results || [];

      let totalKm = 0, totalElevation = 0, rideCount = 0;
      for (const t of trips) {
        const tripDate = (t.departed_at || t.created_at || '').slice(0, 10);
        if (tripDate < startDate || tripDate > endDate) continue;
        totalKm += (t.distance / 1000) || 0;
        totalElevation += t.elevation_gain || 0;
        rideCount++;
      }

      return {
        memberName: link.memberName,
        totalKm: Math.round(totalKm * 10) / 10,
        totalElevation: Math.round(totalElevation),
        rideCount
      };
    }));

    const members = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)
      .sort((a, b) => b.totalKm - a.totalKm);

    return new Response(JSON.stringify({ members }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('rwgps-rides error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
};