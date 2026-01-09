import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  
  const { cart } = JSON.parse(event.body || '{}');
  const sql = neon(process.env.NETLIFY_DATABASE_URL!);
  
  try {
    for (const item of cart) {
        const sku = `BOT-${item.id}-STD`;
        
        // Increment stock back
        await sql`
            UPDATE inventory 
            SET quantity = quantity + 1 
            WHERE sku = ${sku}
        `;
        
        // Log Event
        await sql`
            INSERT INTO inventory_events (sku, delta, reason) 
            VALUES (${sku}, 1, 'paypal_cancel')
        `;
    }
    
    return { statusCode: 200, body: JSON.stringify({ message: 'Inventory released' }) };
  } catch (error: any) {
    console.error("Cancel Order Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};