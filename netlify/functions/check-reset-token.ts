import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { email, token } = JSON.parse(event.body || '{}');
    if (!email || !token) return { statusCode: 400, body: JSON.stringify({ error: "Missing parameters" }) };

    const sql = neon(process.env.NETLIFY_DATABASE_URL!);
    
    const users = await sql`SELECT id, reset_token, reset_token_expires FROM users WHERE email = ${email}`;
    
    if (users.length === 0) return { statusCode: 404, body: JSON.stringify({ error: "Invalid link" }) };
    
    const user = users[0];
    
    if (user.reset_token !== token) {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid token" }) };
    }
    
    if (user.reset_token_expires && new Date() > new Date(user.reset_token_expires)) {
        return { statusCode: 400, body: JSON.stringify({ error: "Link expired" }) };
    }
    
    return { statusCode: 200, body: JSON.stringify({ valid: true }) };
  } catch (e: any) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};