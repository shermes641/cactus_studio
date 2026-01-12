import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    let { id, name, price_cents, image_url, scientific, class: productClass, notes } = JSON.parse(event.body || '{}');
    const sql = neon(process.env.NETLIFY_DATABASE_URL!);

    if (id) {
      await sql`
        UPDATE products 
        SET name = ${name}, price_cents = ${price_cents}, image_url = ${image_url}, scientific = ${scientific || name}, class = ${productClass}, notes = ${notes}
        WHERE id = ${id}
      `;
      return { statusCode: 200, body: JSON.stringify({ message: 'Product updated' }) };
    } else {
      // Default scientific to name if missing to satisfy NOT NULL constraint
      if (!scientific) scientific = name;
      let rows;
      
      try {
        rows = await sql`
          INSERT INTO products (name, price_cents, image_url, scientific, class, notes) 
          VALUES (${name}, ${price_cents}, ${image_url}, ${scientific}, ${productClass}, ${notes}) 
          RETURNING id
        `;
      } catch (err: any) {
        // Auto-fix sequence if out of sync (duplicate key error)
        if (err.message && err.message.includes('products_pkey')) {
           await sql`SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE(max(id), 1)) FROM products`;
           rows = await sql`INSERT INTO products (name, price_cents, image_url, scientific) VALUES (${name}, ${price_cents}, ${image_url}, ${scientific}) RETURNING id`;
        } else throw err;
      }

      const newId = rows[0].id;

      // Insert into inventory with default quantity 1
      const sku = `BOT-${newId}-STD`;
      await sql`
        INSERT INTO inventory (sku, image_id, quantity) 
        VALUES (${sku}, ${newId}, 1)
      `;

      return { statusCode: 200, body: JSON.stringify({ id: String(newId) }) };
    }
  } catch (e: any) {
    console.error('Update product error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};