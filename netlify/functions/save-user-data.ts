import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event: any, context: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const body = JSON.parse(event.body || '{}');
    const { email, cart, shipping_addr } = body;
    if (!email) return { statusCode: 400, body: JSON.stringify({ error: 'Missing email' }) };
    const sql = neon(process.env.NETLIFY_DATABASE_URL!);
    await sql('UPDATE users SET cart = $1::jsonb, shipping_addr = $2 WHERE email = $3', [JSON.stringify(cart || []), shipping_addr || null, email]);
    return { statusCode: 200, body: JSON.stringify({ message: 'Saved' }) };
  } catch (e: any) {
    console.error('save-user-data error', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message || 'Internal' }) };
  }
};
