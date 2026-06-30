export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) headers['Authorization'] = auth;

  const body = req.method !== 'GET' ? await req.text() : undefined;
  const upstream = await fetch(
    `${process.env.VITE_SUPABASE_URL}/functions/v1/widget-customer-auth/me`,
    { method: req.method, headers, body },
  );

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
