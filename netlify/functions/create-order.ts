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
    // 1. Calculate Total & Validate/Reserve Stock
    let totalCents = 0;
    
    // Aggregate cart items to check total quantity needed per SKU
    const skuCounts: { [sku: string]: number } = {};
    for (const item of cart) {
        const sku = `BOT-${item.id}-STD`;
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

    if (isManual) {
        const orderRes = await sql`
            INSERT INTO orders (user_id, total_amount_cents, currency, status, discount_code, shipping_addr, receipt_url)
            VALUES (${userId || null}, ${totalCents}, ${currency}, 'manual_verification', ${discountCode || null}, ${shippingAddress || null}, ${receiptUrl || null})
            RETURNING id
        `;
        const orderId = orderRes[0].id;

        await sql`
            INSERT INTO payments (order_id, provider, provider_payment_id, amount_cents, currency, status)
            VALUES (${orderId}, 'other', ${receiptUrl}, ${totalCents}, ${currency}, 'manual_verification')
        `;

        for (const item of cart) {
            await sql`
                INSERT INTO order_items (order_id, product_id, name, price_cents, quantity)
                VALUES (${orderId}, ${item.id}, ${item.name}, ${item.price_cents}, 1)
            `;
            const sku = `BOT-${item.id}-STD`;
            await sql`UPDATE inventory SET quantity = quantity - 1 WHERE sku = ${sku}`;
            await sql`INSERT INTO inventory_events (sku, delta, reason) VALUES (${sku}, -1, 'manual_sale')`;
        }

        return { statusCode: 200, body: JSON.stringify({ id: orderId }) };
    }

    // 2. Create PayPal Order
    const accessToken = await getAccessToken();
    const orderRes = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
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
    
    const orderData = await orderRes.json();
    
    if (!orderRes.ok) {
        throw new Error(orderData.message || 'PayPal Order Creation Failed');
    }
    
    return {
        statusCode: 200,
        body: JSON.stringify({ id: orderData.id })
    };

  } catch (error: any) {
    console.error("Create Order Error:", error);
    return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message || "Internal Server Error" })
    };
  }
};
