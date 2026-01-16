import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  
  const { cart } = JSON.parse(event.body || '{}');
  const sql = neon(process.env.NETLIFY_DATABASE_URL!);
  
  try {
    // No-op: Inventory is now only decremented on capture, so no need to release reservation.
    // We keep this function endpoint valid so the frontend doesn't break, 
    // but it performs no DB actions.
    
    return { statusCode: 200, body: JSON.stringify({ message: 'Order cancelled' }) };
  } catch (error: any) {
    console.error("Cancel Order Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
