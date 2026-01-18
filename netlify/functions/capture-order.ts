import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { orderId, internalId, details } = JSON.parse(event.body || '{}');
    const sql = neon(process.env.NETLIFY_DATABASE_URL!);

    // 1. Ensure Tables Exist (Idempotent check)
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

    // 2. Extract Data
    const { payer } = details;
    const purchaseUnit = details.purchase_units[0];
    const capture = purchaseUnit.payments.captures[0];
    
    // Convert amounts to cents (integer)
    const captureCents = Math.round(parseFloat(capture.amount.value) * 100);

    // 3. Update Order Status
    let targetId = internalId;
    
    // Fallback lookup if internalId missing
    if (!targetId) {
        const orders = await sql`SELECT id FROM orders WHERE paypal_order_id = ${orderId}`;
        if (orders.length > 0) targetId = orders[0].id;
    }

    if (targetId) {
        await sql`
            UPDATE orders 
            SET status = 'processing', 
                customer_email = ${payer.email_address}, 
                customer_name = ${payer.name.given_name} || ' ' || ${payer.name.surname}
            WHERE id = ${targetId}
        `;

        // 4. Insert Payment
        await sql`
          INSERT INTO payments 
            (order_id, provider, provider_payment_id, amount_cents, currency, status)
          VALUES 
            (${targetId}, 'paypal', ${capture.id}, ${captureCents}, ${capture.amount.currency_code}, ${capture.status})
        `;
        
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, orderId: targetId })
        };
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Order not found" })
    };

  } catch (error: any) {
    console.error("Capture Recording Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
