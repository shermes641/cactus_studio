import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event: any, context: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const body = JSON.parse(event.body || '{}');
    const { email } = body;
    if (!email) return { statusCode: 400, body: JSON.stringify({ error: 'Missing email' }) };
    const sql = neon(process.env.NETLIFY_DATABASE_URL!);
    const rows = await sql('SELECT id, email, name, phone, shipping_addr, cart FROM users WHERE email = $1', [email]);
    if (!rows || rows.length === 0) return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };
    const u = rows[0];
    return { statusCode: 200, body: JSON.stringify({ user: { id: u.id, email: u.email, name: u.name, phone: u.phone, shipping_addr: u.shipping_addr, cart: u.cart || [] } }) };
  } catch (e: any) {
    console.error('get-user-data error', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message || 'Internal' }) };
  }
};
