export default async (req, context) => {
  const raw = process.env.FEATURE_RWGPS;
  const enabled = String(raw || '').toLowerCase() === 'true';
  return new Response(JSON.stringify({
    enabled,
    debug: {
      rawValue: raw === undefined ? '<undefined>' : `"${raw}"`,
      type: typeof raw,
      length: raw ? raw.length : 0
    }
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    }
  });
};