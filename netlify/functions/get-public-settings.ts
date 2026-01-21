import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL!);
    const rows = await sql`SELECT key, value, type FROM settings`;
    
    const settings: Record<string, any> = {};
    for (const row of rows) {
        if (row.type === 'number') {
            settings[row.key] = Number(row.value);
        } else if (row.type === 'boolean') {
            settings[row.key] = row.value === 'true';
        } else {
            settings[row.key] = row.value;
        }
    }

    console.log('Settings:', JSON.stringify(settings));
    return { statusCode: 200, body: JSON.stringify(settings) };
  } catch (e: any) {
    console.error('Failed to get settings:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};