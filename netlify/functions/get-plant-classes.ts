import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event: any, context: any) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL!);
    const rows = await sql`SELECT name FROM plant_classes ORDER BY name ASC`;
    const classes = rows.map(r => r.name);
    return { statusCode: 200, body: JSON.stringify(classes) };
  } catch (e: any) {
    console.error('Error fetching plant classes:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};