/**
 * Netlify Function: restore-preorder
 * 
 * Handles the restoration of orders with 'pre_order' status.
 * This is typically used when a user logs in to recover a session where
 * items were reserved (pre-ordered) but the checkout wasn't completed.
 * 
 * It performs the following:
 * 1. Finds 'pre_order' orders for the user (by ID or email).
 * 2. Restores inventory for items in those orders.
 * 3. Deletes the temporary order and its items.
 * 4. Returns the items to be added back to the cart on the frontend.
 * 
 * @param {object} event - The Netlify function event object.
 * @returns {object} Response with status code and body containing restored items.
 */
import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

/**
 * Handles the restoration of orders with 'pre_order' status.
 * This is typically used when a user logs in to recover a session where
 * items were reserved (pre-ordered) but the checkout wasn't completed.
 * 
 * It performs the following:
 * 1. Finds 'pre_order' orders for the user (by ID or email).
 * 2. Restores inventory for items in those orders.
 * 3. Deletes the temporary order and its items.
 * 4. Returns the items to be added back to the cart on the frontend.
 * 
 * @param {object} event - The Netlify function event object.
 * @returns {object} Response with status code and body containing restored items.
 */
export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { orderId, userId, email } = JSON.parse(event.body || '{}');
    if (!orderId && !userId && !email) return { statusCode: 400, body: JSON.stringify({ error: "Missing order identifier" }) };

    const sql = neon(process.env.NETLIFY_DATABASE_URL!);

    // 1. Find orders with status 'pre_order'
    let orders: any[] = [];
    
    if (orderId) {
        orders = await sql`SELECT id FROM orders WHERE id = ${orderId} AND status IN ('pre_order', 'pending')`;
    } else {
        let uid = userId;
        if (!uid && email) {
             const u = await sql`SELECT id FROM users WHERE email = ${email}`;
             if (u.length > 0) uid = u[0].id;
        }
        
        if (uid) {
            orders = await sql`SELECT id FROM orders WHERE user_id = ${uid} AND status IN ('pre_order', 'pending')`;
        }
    }

    if (orders.length === 0) {
        return { statusCode: 200, body: JSON.stringify({ items: [], orderCount: 0 }) };
    }

    const itemsToRestore: any[] = [];
    try {
        for (const order of orders) {
            // Get items
            const items = await sql`
                SELECT product_id, quantity, sku
                FROM order_items
                WHERE order_id = ${order.id}
            `;

            for (const item of items) {
                // 2. Increment inventory
                if (item.sku) {
                    await sql`UPDATE inventory SET quantity = quantity + ${item.quantity} WHERE sku = ${item.sku}`;
                    await sql`INSERT INTO inventory_events (sku, delta, reason) VALUES (${item.sku}, ${item.quantity}, 'restore_preorder')`;
                }
                itemsToRestore.push({ id: item.product_id });
            }

            // 3. Delete order items
            await sql`DELETE FROM order_items WHERE order_id = ${order.id}`;
            // 4. Delete payment
            await sql`DELETE FROM payments WHERE order_id = ${order.id}`;
            // 5. Delete order
            await sql`DELETE FROM orders WHERE id = ${order.id}`;
        }    
    } catch (e: any) {
        console.error("Restore pre-order error:", e);
        return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }

    return { 
        statusCode: 200, 
        body: JSON.stringify({ 
            items: itemsToRestore, 
            orderCount: orders.length 
        }) 
    };

  } catch (e: any) {
    console.error("Restore pre-order error:", e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
