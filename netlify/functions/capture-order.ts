import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { orderId, details, cart, discountCode, shippingAddress } = JSON.parse(event.body || '{}');
    const sql = neon(process.env.NETLIFY_DATABASE_URL!);

    // 1. Ensure Tables Exist (Idempotent check)
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
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS payments (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT REFERENCES orders(id),
        provider TEXT,
        provider_payment_id TEXT,
        amount_cents INTEGER,
        currency TEXT,
        status TEXT,
        captured_at TIMESTAMPTZ DEFAULT NOW()
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

    // 2. Extract Data
    const { payer } = details;
    const purchaseUnit = details.purchase_units[0];
    const capture = purchaseUnit.payments.captures[0];
    
    // Convert amounts to cents (integer)
    const totalCents = Math.round(parseFloat(purchaseUnit.amount.value) * 100);
    const captureCents = Math.round(parseFloat(capture.amount.value) * 100);

    // 3. Insert Order
    const orderResult = await sql`
      INSERT INTO orders 
        (paypal_order_id, customer_email, customer_name, total_amount_cents, currency, status, discount_code, shipping_addr)
      VALUES 
        (${orderId}, ${payer.email_address}, ${payer.name.given_name} || ' ' || ${payer.name.surname}, ${totalCents}, ${purchaseUnit.amount.currency_code}, 'COMPLETED', ${discountCode || null}, ${shippingAddress || null})
      RETURNING id
    `;
    const internalOrderId = orderResult[0].id;

    // 4. Insert Payment
    await sql`
      INSERT INTO payments 
        (order_id, provider, provider_payment_id, amount_cents, currency, status)
      VALUES 
        (${internalOrderId}, 'paypal', ${capture.id}, ${captureCents}, ${capture.amount.currency_code}, ${capture.status})
    `;

    // 5. Insert Order Items
    for (const item of cart) {
      await sql`
        INSERT INTO order_items (order_id, product_id, name, price_cents, quantity)
        VALUES (${internalOrderId}, ${item.id}, ${item.name}, ${item.price_cents}, 1)
      `;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, orderId: internalOrderId })
    };

  } catch (error: any) {
    console.error("Capture Recording Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
