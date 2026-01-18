import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { token } = JSON.parse(event.body || '{}');
    if (!token) return { statusCode: 400, body: JSON.stringify({ error: "Token required" }) };

    const sql = neon(process.env.NETLIFY_DATABASE_URL!);
    
    // Invalidate session by clearing the token
    await sql`UPDATE users SET session_token = NULL WHERE session_token = ${token}`;
    
    return { statusCode: 200, body: JSON.stringify({ message: "Logged out" }) };
  } catch (e: any) {
    console.error("Logout error:", e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};