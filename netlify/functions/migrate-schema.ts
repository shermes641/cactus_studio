import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event: any, context: any) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const connectionString = process.env.NETLIFY_DATABASE_URL;
  if (!connectionString) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing NETLIFY_DATABASE_URL' }) };
  }

  const sql = neon(connectionString);
  const out: string[] = [];

  try {
    // 1) Ensure statuses table exists
    await sql`CREATE TABLE IF NOT EXISTS statuses (code TEXT PRIMARY KEY, description TEXT)`;
    out.push('ensured statuses table');

    // 2) Ensure users columns
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS shipping_addr TEXT`;
    out.push('ensured users.shipping_addr');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS cart JSONB DEFAULT '[]'::jsonb`;
    out.push('ensured users.cart');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false`;
    out.push('ensured users.is_admin');

    // 3) Ensure orders.status column exists
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT`;
    out.push('ensured orders.status column');

    // 4) Populate statuses with common values + any existing order.status values
    const defaults = ['pending','processing','completed','cancelled','refunded'];
    for (const s of defaults) {
      await sql`INSERT INTO statuses (code, description) VALUES (${s}, ${s}) ON CONFLICT (code) DO NOTHING`;
    }
    out.push('inserted default statuses');

    // Add any distinct status values currently present in orders
    const rows: any[] = await sql`SELECT DISTINCT status FROM orders WHERE status IS NOT NULL`;
    for (const r of rows) {
      const code = r.status;
      if (!code) continue;
      await sql`INSERT INTO statuses (code, description) VALUES (${code}, ${code}) ON CONFLICT (code) DO NOTHING`;
    }
    out.push('copied existing order status values into statuses');

    // 5) Add FK constraint from orders.status -> statuses.code if not exists
    const fkCheck: any[] = await sql`
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'orders' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'status'
    `;
    if (fkCheck.length === 0) {
      try {
        await sql`ALTER TABLE orders ADD CONSTRAINT orders_status_fkey FOREIGN KEY (status) REFERENCES statuses(code)`;
        out.push('added foreign key orders.status -> statuses.code');
      } catch (e: any) {
        out.push('failed to add FK constraint: ' + String(e.message || e));
      }
    } else {
      out.push('foreign key on orders.status already exists');
    }

    // 6) Ensure plant_classes table
    await sql`CREATE TABLE IF NOT EXISTS plant_classes (id BIGSERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL)`;
    out.push('ensured plant_classes table');

    // 7) Seed plant_classes if empty
    const pcCount = await sql`SELECT COUNT(*) FROM plant_classes`;
    if (parseInt(pcCount[0].count) === 0) {
      await sql`
        INSERT INTO plant_classes (name) VALUES 
        ('Opuntia'), ('Euphorbia'), ('Mammillaria'), ('Aizoaceae'), 
        ('Aloe'), ('Crassula'), ('Echeveria'), ('Haworthia'), 
        ('Sansevieria'), ('Sedum'), ('Sempervivum')
      `;
      out.push('seeded plant_classes');
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, actions: out }) };
  } catch (error: any) {
    console.error('Migration failed:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || String(error), actions: out }) };
  }
};
