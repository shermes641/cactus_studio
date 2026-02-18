import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';
import {
  CREATE_PRODUCTS_TABLE,
  CREATE_DISCOUNTS_TABLE,
  CREATE_STATUSES_TABLE,
  CREATE_PLANT_CLASSES_TABLE,
  CREATE_SETTINGS_TABLE,
  CREATE_INVENTORY_TABLE,
  CREATE_INVENTORY_EVENTS_TABLE,
  CREATE_PAYMENTS_TABLE,
  CREATE_WEBHOOK_EVENTS_TABLE,
  CREATE_AUDIT_LOGS_TABLE,
  CREATE_USERS_TABLE,
  CREATE_ORDERS_TABLE,
  CREATE_ORDER_ITEMS_TABLE,
  SEED_STATUSES,
  SEED_PLANT_CLASSES,
  SEED_SETTINGS,
  UPDATE_SETTINGS_TYPES
} from './schema.js';

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
    // Note: This migration is designed to be run multiple times without causing errors.
    // It uses `IF NOT EXISTS` for creating tables and adding columns.

    out.push('Starting schema migration...');

    // 1. Create missing tables (in dependency order)
    const tables = [
      { name: 'products', sql: CREATE_PRODUCTS_TABLE },
      { name: 'discounts', sql: CREATE_DISCOUNTS_TABLE },
      { name: 'statuses', sql: CREATE_STATUSES_TABLE },
      { name: 'plant_classes', sql: CREATE_PLANT_CLASSES_TABLE },
      { name: 'settings', sql: CREATE_SETTINGS_TABLE },
      { name: 'users', sql: CREATE_USERS_TABLE },
      { name: 'inventory', sql: CREATE_INVENTORY_TABLE },
      { name: 'inventory_events', sql: CREATE_INVENTORY_EVENTS_TABLE },
      { name: 'audit_logs', sql: CREATE_AUDIT_LOGS_TABLE },
      { name: 'orders', sql: CREATE_ORDERS_TABLE },
      { name: 'order_items', sql: CREATE_ORDER_ITEMS_TABLE },
      { name: 'payments', sql: CREATE_PAYMENTS_TABLE },
      { name: 'webhook_events', sql: CREATE_WEBHOOK_EVENTS_TABLE },
    ];

    const createdTables = new Set<string>();

    for (const t of tables) {
      const check = await sql`SELECT 1 FROM information_schema.tables WHERE table_name = ${t.name}`;
      if (check.length === 0) {
        // Table doesn't exist, create it using canonical schema
         await sql.query(t.sql);
        createdTables.add(t.name);
        out.push(`Created table ${t.name}`);
      } else {
        out.push(`Table ${t.name} exists`);
      }
    }

    // 2. Add missing columns to existing tables
    
    // products table
    if (!createdTables.has('products')) {
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS class TEXT`;
    out.push('ensured products.class');
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS notes TEXT`;
    out.push('ensured products.notes');
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT`;
    out.push('ensured products.sku');
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()`;
    out.push('ensured products.created_at');
    }

    // users table
    if (!createdTables.has('users')) {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT`;
    out.push('ensured users.name');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`;
    out.push('ensured users.phone');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS shipping_addr TEXT`;
    out.push('ensured users.shipping_addr');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS cart JSONB DEFAULT '[]'::jsonb`;
    out.push('ensured users.cart');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false`;
    out.push('ensured users.is_admin');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false`;
    out.push('ensured users.is_verified');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT`;
    out.push('ensured users.verification_token');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMPTZ`;
    out.push('ensured users.verification_token_expires');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT`;
    out.push('ensured users.reset_token');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ`;
    out.push('ensured users.reset_token_expires');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token TEXT`;
    out.push('ensured users.session_token');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS discount_code TEXT REFERENCES discounts(code)`;
    out.push('ensured users.discount_code');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()`;
    out.push('ensured users.created_at');
    }
    
    // orders table
    if (!createdTables.has('orders')) {
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id)`;
    out.push('ensured orders.user_id');
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paypal_order_id TEXT`;
    out.push('ensured orders.paypal_order_id');
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT`;
    out.push('ensured orders.customer_email');
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT`;
    out.push('ensured orders.customer_name');
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code TEXT REFERENCES discounts(code)`;
    out.push('ensured orders.discount_code');
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount_cents INTEGER`;
    out.push('ensured orders.total_amount_cents');
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency TEXT`;
    out.push('ensured orders.currency');
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT`;
    out.push('ensured orders.status');
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_addr TEXT`;
    out.push('ensured orders.shipping_addr');
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_url TEXT`;
    out.push('ensured orders.receipt_url');
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ`;
    out.push('ensured orders.shipped_at');
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()`;
    out.push('ensured orders.created_at');
    }

    // order_items table
    if (!createdTables.has('order_items')) {
    await sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sku TEXT`;
    out.push('ensured order_items.sku');
    }

    // settings table (was already handled by CREATE IF NOT EXISTS, but this is safe)
    if (!createdTables.has('settings')) {
    await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'string'`;
    out.push('ensured settings table');
    }

    // 3. Drop obsolete tables
    await sql`DROP TABLE IF EXISTS user_discounts`;
    out.push('dropped obsolete user_discounts table');

    // 4. Data seeding and FK constraints (idempotent operations)
     await sql.query(SEED_STATUSES);
    out.push('inserted default statuses');

    const rows: any[] = await sql`SELECT DISTINCT status FROM orders WHERE status IS NOT NULL`;
    for (const r of rows) {
      const code = r.status;
      if (!code) continue;
      await sql`INSERT INTO statuses (code, description) VALUES (${code}, ${code}) ON CONFLICT (code) DO NOTHING`;
    }
    out.push('copied existing order status values into statuses');

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

     await sql.query(SEED_PLANT_CLASSES);
    out.push('seeded plant_classes');

     await sql.query(SEED_SETTINGS);
    out.push('seeded settings');

     await sql.query(UPDATE_SETTINGS_TYPES);
    out.push('updated settings types');

    return { statusCode: 200, body: JSON.stringify({ ok: true, actions: out }) };
  } catch (error: any) {
    console.error('Migration failed:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || String(error), actions: out }) };
  }
};
