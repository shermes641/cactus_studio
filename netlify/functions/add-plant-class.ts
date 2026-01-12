import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  
  try {
    const { name } = JSON.parse(event.body || '{}');
    if (!name) return { statusCode: 400, body: JSON.stringify({ error: "Name required" }) };

    const sql = neon(process.env.NETLIFY_DATABASE_URL!);
    
    const existing = await sql`SELECT id FROM plant_classes WHERE name = ${name}`;
    if (existing.length > 0) {
        return { statusCode: 200, body: JSON.stringify({ message: "Class already exists" }) };
    }

    await sql`INSERT INTO plant_classes (name) VALUES (${name})`;
    return { statusCode: 200, body: JSON.stringify({ message: "Class added" }) };
  } catch (e: any) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};