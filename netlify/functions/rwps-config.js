export default async (req, context) => {
  const enabled = String(process.env.FEATURE_RWGPS || '').toLowerCase() === 'true';
  return new Response(JSON.stringify({ enabled }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    }
  });
};