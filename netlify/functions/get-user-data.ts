import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event: any, context: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    let body = {};
    try {
        body = JSON.parse(event.body || '{}');
    } catch (e) {
        console.error("JSON parse error", e);
        return { statusCode: 400, body: "Invalid JSON" };
    }
    
    const { email, token } = body as any;
    
    const sql = neon(process.env.NETLIFY_DATABASE_URL!);

    if (token) {
        const rows = await sql('SELECT id, email, name, phone, shipping_addr, cart, is_admin, discount_code FROM users WHERE session_token = $1', [token]);
        if (rows.length === 0) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid or expired session' }) };
        const u = rows[0];
        return { statusCode: 200, body: JSON.stringify({ user: { id: u.id, email: u.email, name: u.name, phone: u.phone, shipping_addr: u.shipping_addr, cart: u.cart || [], is_admin: !!u.is_admin, discount_code: u.discount_code } }) };
    }

    if (email) {
        const rows = await sql('SELECT id, email, name, phone, shipping_addr, cart, is_admin, discount_code FROM users WHERE email = $1', [email]);
        if (rows.length === 0) return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };
        const u = rows[0];
        return { statusCode: 200, body: JSON.stringify({ user: { id: u.id, email: u.email, name: u.name, phone: u.phone, shipping_addr: u.shipping_addr, cart: u.cart || [], is_admin: !!u.is_admin, discount_code: u.discount_code } }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Missing email or token' }) };
  } catch (e: any) {
    console.error('get-user-data error', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message || 'Internal' }) };
  }
};
