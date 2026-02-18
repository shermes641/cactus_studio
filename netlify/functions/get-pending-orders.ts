import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  
  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL!);
    const status = event.queryStringParameters?.status || 'active';
    const userId = event.queryStringParameters?.userId;

    let query;
    const baseQuery = `
        SELECT 
            o.id, 
            o.customer_name, 
            o.customer_email, 
            o.total_amount_cents, 
            o.currency, 
            o.status, 
            o.receipt_url, 
            o.created_at,
            o.shipping_addr,
            o.paypal_order_id,
            u.name as user_name,
            u.email as user_email
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
    `;

    let whereClause = "";
    const args = [];

    if (userId) {
        whereClause = ` WHERE o.user_id = $${args.length + 1}`;
        args.push(userId);
    }

    if (status === 'active') {
        query =sql.query(baseQuery + (whereClause ? whereClause + " AND" : " WHERE") + ` o.status IN ('processing', 'manual_verification') ORDER BY o.created_at DESC`, args);
    } else if (status === 'all') {
        query =sql.query(baseQuery + whereClause + ` ORDER BY o.created_at DESC`, args);
    } else {
        query =sql.query(baseQuery + (whereClause ? whereClause + " AND" : " WHERE") + ` o.status = $${args.length + 1} ORDER BY o.created_at DESC`, [...args, status]);
    }

    const orders = await query;
    return { statusCode: 200, body: JSON.stringify(orders) };
  } catch (e: any) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
