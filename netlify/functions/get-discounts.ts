import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  
  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL!);
    const discounts = await sql`SELECT code FROM discounts WHERE active = true ORDER BY code ASC`;
    return { statusCode: 200, body: JSON.stringify(discounts) };
  } catch (e: any) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};