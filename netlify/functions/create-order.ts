import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

const PAYPAL_API = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

async function getAccessToken() {
  //const clientId = process.env.PAYPAL_CLIENT_ID || process.env.PAYPAL_SANDBOX_CLIENT_ID;
  const clientId = process.env.PAYPAL_MODE === 'live'
  ? process.env.PAYPAL_CLIENT_ID
  : process.env.PAYPAL_SANDBOX_CLIENT_ID;
  //const secret = process.env.PAYPAL_SECRET || process.env.PAYPAL_SANDBOX_SECRET || process.env.PAYPAL_SANDBOX_CLIENT_SECRET;
  const secret = process.env.PAYPAL_MODE === 'live'
  ? process.env.PAYPAL_SECRET
  : process.env.PAYPAL_SANDBOX_CLIENT_SECRET;

  if (!clientId || !secret) {
    throw new Error("Missing PayPal Credentials in Environment Variables");
  }

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');

  const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  
  if (!response.ok) {
      const text = await response.text();
      throw new Error(`PayPal Auth Failed: ${text}`);
  }
  
  const data = await response.json();
  return data.access_token;
}

export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  
  let cart: any[];
  let discountCode: string | null;
  let currency: string;
  let receiptUrl: string | null;
  let isManual: boolean;
  let shippingAddress: string | null;
  let userId: number | null;
  try {
      const body = JSON.parse(event.body || '{}');
      cart = body.cart;
      discountCode = body.discountCode;
      currency = body.currency || 'USD';
      receiptUrl = body.receiptUrl;
      isManual = body.isManual;
      shippingAddress = body.shippingAddress;
      userId = body.userId;
  } catch (e) {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const sql = neon(process.env.NETLIFY_DATABASE_URL!);
  
  try {
    // Ensure Tables Exist (Idempotent check)
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT,
        paypal_order_id TEXT,
        customer_email TEXT,
        customer_name TEXT,
        discount_code TEXT,
        total_amount_cents INTEGER,
        currency TEXT,
        status TEXT,
        shipping_addr TEXT,
        receipt_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS order_items (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT REFERENCES orders(id),
        product_id BIGINT REFERENCES products(id),
        name TEXT,
        price_cents INTEGER,
        quantity INTEGER
      )
    `;

    // 1. Calculate Total & Validate/Reserve Stock
    let totalCents = 0;
    
    // Aggregate cart items to check total quantity needed per SKU
    const skuCounts: { [sku: string]: number } = {};
    for (const item of cart) {
        const cleanClass = (item.class || 'NONE').replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
        const cleanName = (item.name || '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
        const sku = `${cleanClass}-${item.id}-${cleanName}`;
        skuCounts[sku] = (skuCounts[sku] || 0) + 1;
        totalCents += item.price_cents;
    }
    
    // Check stock availability
    for (const [sku, count] of Object.entries(skuCounts)) {
        const result = await sql`
            SELECT quantity FROM inventory WHERE sku = ${sku}
        `;
        
        if (result.length === 0 || result[0].quantity < count) {
            throw new Error(`Out of stock for item: ${sku} (Requested: ${count}, Available: ${result.length > 0 ? result[0].quantity : 0})`);
        }
    }
    
    // Apply discount
    if (discountCode) {
        const discounts = await sql`SELECT type, value FROM discounts WHERE code = ${discountCode} AND active = true`;
        if (discounts.length > 0) {
            const discount = discounts[0];
            if (discount.type === 'percent') {
                totalCents = Math.round(totalCents * (1 - discount.value / 100));
            }
        }
    }

    // 2. Create Internal Order & Reserve Stock (For BOTH Manual and PayPal)
    const status = isManual ? 'manual_verification' : 'pending';
    
    const orderRes = await sql`
        INSERT INTO orders (user_id, total_amount_cents, currency, status, discount_code, shipping_addr, receipt_url)
        VALUES (${userId || null}, ${totalCents}, ${currency}, ${status}, ${discountCode || null}, ${shippingAddress || null}, ${receiptUrl || null})
        RETURNING id
    `;
    const internalId = orderRes[0].id;

    // Insert Items & Decrement Inventory
    for (const item of cart) {
        await sql`
            INSERT INTO order_items (order_id, product_id, name, price_cents, quantity)
            VALUES (${internalId}, ${item.id}, ${item.name}, ${item.price_cents}, 1)
        `;
        const cleanClass = (item.class || 'NONE').replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
        const cleanName = (item.name || '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
        const sku = `${cleanClass}-${item.id}-${cleanName}`;
        
        await sql`UPDATE inventory SET quantity = quantity - 1 WHERE sku = ${sku}`;
        await sql`INSERT INTO inventory_events (sku, delta, reason) VALUES (${sku}, -1, ${isManual ? 'manual_sale' : 'paypal_reservation'})`;
    }

    if (isManual) {
        await sql`
            INSERT INTO payments (order_id, provider, provider_payment_id, amount_cents, currency, status)
            VALUES (${internalId}, 'other', ${receiptUrl}, ${totalCents}, ${currency}, 'manual_verification')
        `;
        return { statusCode: 200, body: JSON.stringify({ id: internalId }) };
    }

    // 3. Create PayPal Order (If not manual)
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

        // Link PayPal ID to Internal Order
        await sql`UPDATE orders SET paypal_order_id = ${orderData.id} WHERE id = ${internalId}`;
        
        return {
            statusCode: 200,
            body: JSON.stringify({ id: orderData.id, internalId: internalId })
        };
    } catch (e: any) {
        // Rollback: Restore inventory if PayPal creation failed
        console.error("PayPal creation failed, rolling back inventory...", e);
        
        // We can reuse the cancel logic here essentially, or just manually revert
        // Since we are in the same execution context, let's just revert.
        const items = await sql`SELECT product_id, name, p.class FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE order_id = ${internalId}`;
        for (const item of items) {
             const cleanClass = (item.class || 'NONE').replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
             const cleanName = (item.name || '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
             const sku = `${cleanClass}-${item.product_id}-${cleanName}`;
             await sql`UPDATE inventory SET quantity = quantity + 1 WHERE sku = ${sku}`;
             await sql`INSERT INTO inventory_events (sku, delta, reason) VALUES (${sku}, 1, 'paypal_creation_failed')`;
        }
        await sql`UPDATE orders SET status = 'cancelled' WHERE id = ${internalId}`;
        
        throw e;
    }

  } catch (error: any) {
    console.error("Create Order Error:", error);
    return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message || "Internal Server Error" })
    };
  }
};
