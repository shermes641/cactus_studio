import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

/**
 * Netlify Function: cancel-order
 *
 * This serverless function cancels an order by setting its status to 'cancelled'.
 * If the order is in the 'shipped' or 'canceled' state, it also reverts the inventory reservation.
 *
 * Request Body:
 * - orderId: The PayPal order ID to cancel.
 * - internalId: The internal order ID to cancel.
 *
 * Response:
 * - { statusCode: 200, body: { message: 'Order cancelled' } }
 * - { statusCode: 500, body: { error: 'Internal Server Error' } }
 */

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
         if (currentOrder.length > 0 && currentOrder[0].status !== 'shipped' && currentOrder[0].status !== 'cancelled') {
             const items = await sql`SELECT sku, quantity FROM order_items WHERE order_id = ${targetId}`;
             for (const item of items) {
                if (item.sku) {
                    await sql`UPDATE inventory SET quantity = quantity + ${item.quantity || 1} WHERE sku = ${item.sku}`;
                    await sql`INSERT INTO inventory_events (sku, delta, reason) VALUES (${item.sku}, ${item.quantity || 1}, 'reservation_cancelled')`;
                }
             }
             await sql`UPDATE orders SET status = 'cancelled' WHERE id = ${targetId}`;
             await sql`UPDATE payments SET status = 'cancelled' WHERE order_id = ${targetId}`;
         }
    }
    
    return { statusCode: 200, body: JSON.stringify({ message: 'Order cancelled' }) };
  } catch (error: any) {
    console.error("Cancel Order Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
