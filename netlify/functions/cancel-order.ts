import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  
  const { orderId, internalId } = JSON.parse(event.body || '{}');
  const sql = neon(process.env.NETLIFY_DATABASE_URL!);
  
  try {
    let targetId = internalId;
    
    if (!targetId && orderId) {
        const orders = await sql`SELECT id FROM orders WHERE paypal_order_id = ${orderId}`;
        if (orders.length > 0) targetId = orders[0].id;
    }

    if (targetId) {
         const currentOrder = await sql`SELECT status FROM orders WHERE id = ${targetId}`;
         if (currentOrder.length > 0 && currentOrder[0].status === 'pending') {
             const items = await sql`SELECT product_id, name, p.class FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE order_id = ${targetId}`;
             for (const item of items) {
                 const cleanClass = (item.class || 'NONE').replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
                 const cleanName = (item.name || '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
                 const sku = `${cleanClass}-${item.product_id}-${cleanName}`;
                 await sql`UPDATE inventory SET quantity = quantity + 1 WHERE sku = ${sku}`;
                 await sql`INSERT INTO inventory_events (sku, delta, reason) VALUES (${sku}, 1, 'reservation_cancelled')`;
             }
             await sql`UPDATE orders SET status = 'cancelled' WHERE id = ${targetId}`;
         }
    }
    
    return { statusCode: 200, body: JSON.stringify({ message: 'Order cancelled' }) };
  } catch (error: any) {
    console.error("Cancel Order Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
