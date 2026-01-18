import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  
  try {
    const orderId = event.queryStringParameters?.orderId;
    if (!orderId) return { statusCode: 400, body: JSON.stringify({ error: "Missing orderId" }) };

    const sql = neon(process.env.NETLIFY_DATABASE_URL!);
    
    const items = await sql`
        SELECT oi.*, p.image_url, p.scientific, p.class
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ${orderId}
    `;
    
    return { statusCode: 200, body: JSON.stringify(items) };
  } catch (e: any) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
