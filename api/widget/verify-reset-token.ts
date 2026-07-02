export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const upstream = await fetch(
    `${process.env.SUPABASE_URL}/functions/v1/widget-customer-auth/verify-reset-token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: await req.text(),
    },
  );

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
