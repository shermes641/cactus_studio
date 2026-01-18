import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  
  try {
    const { orderIds, status } = JSON.parse(event.body || '{}');
    
    if (!orderIds || !Array.isArray(orderIds) || !status) {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid parameters. 'orderIds' must be an array and 'status' is required." }) };
    }

    const sql = neon(process.env.NETLIFY_DATABASE_URL!);
    
    for (const id of orderIds) {
        if (status === 'cancelled') {
             const currentOrder = await sql`SELECT status FROM orders WHERE id = ${id}`;
             if (currentOrder.length > 0 && currentOrder[0].status !== 'cancelled') {
                 const items = await sql`
                    SELECT oi.product_id, oi.quantity, p.class, p.name 
                    FROM order_items oi
                    LEFT JOIN products p ON oi.product_id = p.id
                    WHERE oi.order_id = ${id}
                 `;
                 for (const item of items) {
                     const cleanClass = (item.class || 'NONE').replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
                     const cleanName = (item.name || '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
                     const sku = `${cleanClass}-${item.product_id}-${cleanName}`;
                     await sql`UPDATE inventory SET quantity = quantity + ${item.quantity} WHERE sku = ${sku}`;
                     await sql`INSERT INTO inventory_events (sku, delta, reason) VALUES (${sku}, ${item.quantity}, 'order_cancelled')`;
                 }
             }
        }
        await sql`UPDATE orders SET status = ${status} WHERE id = ${id}`;
    }
    
    return { statusCode: 200, body: JSON.stringify({ message: "Order statuses updated successfully" }) };
  } catch (e: any) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};