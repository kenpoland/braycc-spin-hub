import { getStore } from '@netlify/blobs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const RWGPS_API_KEY = process.env.RWGPS_API_KEY;

export default async (req, context) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  if (String(process.env.FEATURE_RWGPS || '').toLowerCase() !== 'true') {
    return new Response(JSON.stringify({ error: 'Ride with GPS integration is disabled.' }), {
      status: 503, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { email, password, memberName } = await req.json();
    if (!email || !password || !memberName) {
      return new Response(JSON.stringify({ error: 'email, password, memberName required' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    const rwUrl = `https://ridewithgps.com/users/current.json?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&apikey=${RWGPS_API_KEY}&version=2`;

    const rwRes = await fetch(rwUrl);
    if (!rwRes.ok) {
      return new Response(JSON.stringify({
        error: 'Ride with GPS rejected the login. Check your email and password.'
      }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    const rwData = await rwRes.json();
    const authToken = rwData.user && rwData.user.auth_token;
    const rwgpsUserId = rwData.user && rwData.user.id;

    if (!authToken || !rwgpsUserId) {
      return new Response(JSON.stringify({ error: 'Ride with GPS did not return an auth token.' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    const store = getStore('braycc');
    const data = (await store.get('data', { type: 'json' })) || { rwgpsLinks: [] };
    data.rwgpsLinks = data.rwgpsLinks || [];

    const existing = data.rwgpsLinks.find(l =>
      String(l.memberName).toLowerCase() === String(memberName).toLowerCase()
    );
    if (existing) {
      existing.rwgpsUserId = rwgpsUserId;
      existing.authToken = authToken;
      existing.linkedAt = new Date().toISOString();
    } else {
      data.rwgpsLinks.push({
        memberName: String(memberName).slice(0, 80),
        rwgpsUserId,
        authToken,
        linkedAt: new Date().toISOString()
      });
    }
    await store.setJSON('data', data);

    return new Response(JSON.stringify({ ok: true, memberName, rwgpsUserId }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('rwgps-auth error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
};