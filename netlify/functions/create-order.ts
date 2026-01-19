import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

const PAYPAL_API = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

/**
 * Retrieves an OAuth2 access token from the PayPal API.
 * @async
 * @returns {Promise<string>} The access token.
 * @throws {Error} If PayPal credentials are not configured or if the API call fails.
 */
async function getAccessToken() {
  //const clientId = process.env.PAYPAL_CLIENT_ID || process.env.PAYPAL_SANDBOX_CLIENT_ID;
  // Select credentials based on the current mode (live or sandbox).
  const clientId = process.env.PAYPAL_MODE === 'live'
  ? process.env.PAYPAL_CLIENT_ID
  : process.env.PAYPAL_SANDBOX_CLIENT_ID;
  //const secret = process.env.PAYPAL_SECRET || process.env.PAYPAL_SANDBOX_SECRET || process.env.PAYPAL_SANDBOX_CLIENT_SECRET;
  const secret = process.env.PAYPAL_MODE === 'live'
  ? process.env.PAYPAL_SECRET
  : process.env.PAYPAL_SANDBOX_CLIENT_SECRET;

  // Ensure credentials are set in environment variables.
  if (!clientId || !secret) {
    throw new Error("Missing PayPal Credentials in Environment Variables");
  }

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');

  const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    // Request an access token using client credentials grant type.
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  
  // Handle non-successful responses from PayPal.
  if (!response.ok) {
      const text = await response.text();
      throw new Error(`PayPal Auth Failed: ${text}`);
  }
  
  const data = await response.json();
  return data.access_token;
}

/**
 * Netlify Function handler for creating an order.
 * 
 * This function orchestrates the entire order creation process:
 * 1. Validates the incoming cart data.
 * 2. Fetches current product details (price, stock) from the database to prevent race conditions.
 * 3. Calculates the total, applying any valid discounts.
 * 4. Creates an internal order record in the 'orders' table with a 'pending' status.
 * 5. Atomically reserves stock by decrementing inventory counts for each item in the cart.
 *    - If any inventory operation fails, it rolls back all changes for the current order.
 * 6. If it's a manual order, it records the payment and finishes.
 * 7. If it's a PayPal order, it creates an order with the PayPal API.
 *    - If PayPal API call fails, it rolls back the inventory reservation.
 * 8. Links the PayPal order ID to the internal order record.
 * 9. Returns the PayPal order ID and internal order ID to the client.
 */
export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  
  // 1. Parse request body
  let cart: any[];
  let discountCode: string | null;
  let currency: string;
  let receiptUrl: string | null;
  let isManual: boolean;
  let preOrder: boolean | null;
  let shippingAddress: string | null;
  let userId: number | null;
  try {
      const body = JSON.parse(event.body || '{}');
      cart = body.cart;
      discountCode = body.discountCode;
      currency = body.currency || 'USD';
      receiptUrl = body.receiptUrl;
      isManual = body.isManual;
      preOrder = body.preOrder;
      shippingAddress = body.shippingAddress;
      userId = body.userId;
  } catch (e) {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  // Validate cart contents.
  if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Cart is empty" }) };
  }

  const sql = neon(process.env.NETLIFY_DATABASE_URL!);
  
  try {
    // 2. Calculate Total & Validate Stock
    let totalCents = 0;
    let ordId = null;
    
    // Fetch fresh product data from DB to ensure valid SKUs, prices, and stock.
    const uniqueIds = [...new Set(cart.map((i: any) => i.id))];
    const dbItems: Record<number, { sku: string, price: number, name: string, quantity: number }> = {};

    // Create a map of current product data from the database.
    for (const id of uniqueIds) {
         const rows = await sql`
            SELECT i.sku, i.quantity, p.price_cents, p.name 
            FROM products p 
            JOIN inventory i ON p.id = i.image_id 
            WHERE p.id = ${id}
        `;
        if (rows.length > 0) {
            dbItems[id] = {
                sku: rows[0].sku,
                price: rows[0].price_cents,
                name: rows[0].name,
                quantity: rows[0].quantity
            };
        } else {
            throw new Error(`Product ID ${id} unavailable.`);
        }
    }

    // Count how many of each SKU are being requested in the cart.
    const skuCounts: { [sku: string]: number } = {};
    for (const item of cart) {
        const dbItem = dbItems[item.id];
        if (!dbItem) throw new Error(`Invalid item ${item.id}`);
        
        const { sku } = dbItem;
        skuCounts[sku] = (skuCounts[sku] || 0) + 1;
        totalCents += dbItem.price;
    }
    
    // Check if there is enough stock for each requested SKU.
    if (preOrder) for (const [sku, count] of Object.entries(skuCounts)) {
        const itemWithSku = Object.values(dbItems).find(i => i.sku === sku);
        const available = itemWithSku ? itemWithSku.quantity : 0;
        
        if (available < count && preOrder) {
            throw new Error(`Out of stock for item: ${sku} (Requested: ${count}, Available: ${available})`);
        }
    }
    
    // Apply discount if a valid code is provided.
    if (discountCode) {
        const discounts = await sql`SELECT type, value FROM discounts WHERE code = ${discountCode} AND active = true`;
        if (discounts.length > 0) {
            const discount = discounts[0];
            if (discount.type === 'percent') {
                totalCents = Math.round(totalCents * (1 - discount.value / 100));
            }
        }
    }

    // 3. Create Internal Order & Reserve Stock (for both Manual and PayPal)
    let status = isManual ? 'manual_verification' : 'pending';
    status = isManual && receiptUrl == null ? 'pre_order' : status;
    
    // Create a new record in the 'orders' table.
    if (preOrder) {
    const orderRes = await sql`
        INSERT INTO orders (user_id, total_amount_cents, currency, status, discount_code, shipping_addr, receipt_url)
        VALUES (${userId || null}, ${totalCents}, ${currency}, ${status}, ${discountCode || null}, ${shippingAddress || null}, ${receiptUrl || null})
        RETURNING id`;
        ordId = orderRes[0].id;
    } else {
        const orders = await sql`SELECT id FROM orders WHERE user_id = ${userId} AND status = 'pre_order'`;
        if (orders.length !== 1) throw new Error(`Pre-order error. ${orders.length} `);
        ordId = orders[0].id;
    }
    const internalId = ordId;

    // This array tracks which SKUs have been processed to allow for rollback on failure.
    const processedSkus: string[] = [];
    if (preOrder) {
        try {
            // Loop through each item in the cart to create order line items and decrement inventory.
            for (const item of cart) {
                const dbItem = dbItems[item.id];
                const { sku } = dbItem;
                
                await sql`
                    INSERT INTO order_items (order_id, product_id, name, price_cents, quantity, sku)
                    VALUES (${internalId}, ${item.id}, ${dbItem.name}, ${dbItem.price}, 1, ${sku})
                `;
                if (preOrder) { // Skip inventory decrement for pre-orders
                    // Atomically decrement the inventory quantity. The `quantity > 0` check helps prevent race conditions.
                    const updateRes = await sql`UPDATE inventory SET quantity = quantity - 1 WHERE sku = ${sku} AND quantity > 0 RETURNING quantity`;
                    if (updateRes.length === 0) {
                        // If the update affected 0 rows, it means stock ran out between the check and now.
                        throw new Error(`Failed to decrement inventory for ${sku}. Item might be out of stock.`);
                    }
                    // Log the inventory change event for auditing.
                    await sql`INSERT INTO inventory_events (sku, delta, reason) VALUES (${sku}, -1, ${isManual ? 'manual_sale' : 'paypal_reservation'})`;
                }
                processedSkus.push(sku);
            }
        } catch (e) {
            // If any inventory operation fails, roll back all changes for this order.
            for (const sku of processedSkus) {
                await sql`UPDATE inventory SET quantity = quantity + 1 WHERE sku = ${sku}`;
                await sql`INSERT INTO inventory_events (sku, delta, reason) VALUES (${sku}, 1, 'rollback_failed_order')`;
            }
            await sql`UPDATE orders SET status = 'cancelled' WHERE id = ${internalId}`;
            throw e;
        }
    }

    // 4. Handle preOrder Order
    if (isManual) {
        if (preOrder) {
            await sql`UPDATE orders SET status = 'pre_order' WHERE id = ${internalId}`;
        } else {
            await sql`
                INSERT INTO payments (order_id, provider, provider_payment_id, amount_cents, currency, status)
                VALUES (${internalId}, 'other', ${receiptUrl}, ${totalCents}, ${currency}, 'manual_verification')
            `;
            await sql`UPDATE orders SET status = 'manual_verification' WHERE id = ${internalId}`;
        }
        return { statusCode: 200, body: JSON.stringify({ id: internalId }) };
    }

    // 5. Create PayPal Order (if not manual)
    try {
        const accessToken = await getAccessToken();
        const paypalRes = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [{
                    amount: {
                        currency_code: currency,
                        value: (totalCents / 100).toFixed(2)
                    }
                }]
            })
        });
        
        const orderData = await paypalRes.json();
        
        if (!paypalRes.ok) {
            throw new Error(orderData.message || 'PayPal Order Creation Failed');
        }

        // Link the created PayPal Order ID to our internal order record.
        await sql`UPDATE orders SET paypal_order_id = ${orderData.id} WHERE id = ${internalId}`;
        
        return {
            statusCode: 200,
            body: JSON.stringify({ id: orderData.id, internalId: internalId })
        };
    } catch (e) {
        // If PayPal order creation fails, roll back the inventory reservation.
        for (const sku of processedSkus) {
            await sql`UPDATE inventory SET quantity = quantity + 1 WHERE sku = ${sku}`;
            await sql`INSERT INTO inventory_events (sku, delta, reason) VALUES (${sku}, 1, 'rollback_paypal_fail')`;
        }
        await sql`UPDATE orders SET status = 'cancelled' WHERE id = ${internalId}`;
        throw e;
    }

  } catch (error: any) {
    // Catch-all for any other errors during the process.
    console.error("Create Order Error:", error);
    return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message || "Internal Server Error" })
    };
  }
};
