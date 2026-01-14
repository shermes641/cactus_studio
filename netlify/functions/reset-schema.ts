import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event: any, context: any) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sql = neon(process.env.NETLIFY_DATABASE_URL!);

  try {
    // 1. Drop Tables (Reverse Dependency Order)
    await sql`DROP TABLE IF EXISTS webhook_events CASCADE`;
    await sql`DROP TABLE IF EXISTS order_items CASCADE`;
    await sql`DROP TABLE IF EXISTS payments CASCADE`;
    await sql`DROP TABLE IF EXISTS orders CASCADE`;
    await sql`DROP TABLE IF EXISTS user_discounts CASCADE`;
    await sql`DROP TABLE IF EXISTS discounts CASCADE`;
    await sql`DROP TABLE IF EXISTS users CASCADE`;
    await sql`DROP TABLE IF EXISTS inventory_events CASCADE`;
    await sql`DROP TABLE IF EXISTS inventory CASCADE`;
    await sql`DROP TABLE IF EXISTS products CASCADE`;

    // 2. Create Tables (Dependency Order)

    // Products
    await sql`
      CREATE TABLE products (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        image_url TEXT NOT NULL,
        scientific TEXT NOT NULL,
        class TEXT,
        price_cents INTEGER NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    // Inventory
    await sql`
      CREATE TABLE inventory (
        sku TEXT PRIMARY KEY,
        image_id BIGINT REFERENCES products(id),
        color TEXT,
        size TEXT,
        price_cents INTEGER,
        quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
        active BOOLEAN DEFAULT true
      )
    `;

    // Inventory Events
    await sql`
      CREATE TABLE inventory_events (
        id BIGSERIAL PRIMARY KEY,
        sku TEXT REFERENCES inventory(sku),
        delta INTEGER NOT NULL,
        reason TEXT NOT NULL,
        ref TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    // Discounts (Created before users for FK reference)
    await sql`
      CREATE TABLE discounts (
        code TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('percent', 'shipping')),
        value INTEGER NOT NULL,
        active BOOLEAN DEFAULT true
      )
    `;

    // Users
    await sql`
      CREATE TABLE users (
        id BIGSERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        phone TEXT,
        shipping_addr TEXT,
        cart JSONB,
        is_admin BOOLEAN DEFAULT false,
        is_verified BOOLEAN DEFAULT false,
        verification_token TEXT,
        verification_token_expires TIMESTAMPTZ,
        reset_token TEXT,
        reset_token_expires TIMESTAMPTZ,
        discount_code TEXT REFERENCES discounts(code),
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    // Statuses lookup
    await sql`
      CREATE TABLE statuses (
        code TEXT PRIMARY KEY,
        description TEXT
      )
    `;

    // Plant Classes
    await sql`
      CREATE TABLE plant_classes (
        id BIGSERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      )
    `;

    // Orders
    await sql`
      CREATE TABLE orders (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(id),
        paypal_order_id TEXT,
        customer_email TEXT,
        customer_name TEXT,
        discount_code TEXT REFERENCES discounts(code),
        total_amount_cents INTEGER,
        currency TEXT,
        status TEXT REFERENCES statuses(code),
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    // Order Items
    await sql`
      CREATE TABLE order_items (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT REFERENCES orders(id),
        product_id BIGINT REFERENCES products(id),
        name TEXT,
        price_cents INTEGER,
        quantity INTEGER
      )
    `;

    // Payments
    await sql`
      CREATE TABLE payments (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT REFERENCES orders(id),
        provider TEXT,
        provider_payment_id TEXT,
        amount_cents INTEGER,
        currency TEXT,
        status TEXT,
        captured_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    // Webhook Events
    await sql`
      CREATE TABLE webhook_events (
        provider TEXT,
        event_id TEXT,
        payload JSONB,
        received_at TIMESTAMPTZ DEFAULT now(),
        PRIMARY KEY (provider, event_id)
      )
    `;

    // 3. Seed Initial Data (Discounts)
    await sql`
      INSERT INTO discounts (code, type, value) VALUES 
      ('SAVE5', 'percent', 5), 
      ('SAVE10', 'percent', 10), 
      ('SAVE15', 'percent', 15), 
      ('SAVE20', 'percent', 20), 
      ('FREESHIP', 'shipping', 0)
    `;

    await sql`
      INSERT INTO plant_classes (name) VALUES 
      ('Opuntia'), ('Euphorbia'), ('Mammillaria'), ('Aizoaceae'), 
      ('Aloe'), ('Crassula'), ('Echeveria'), ('Haworthia'), 
      ('Sansevieria'), ('Sedum'), ('Sempervivum')
    `;

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Schema reset and tables created successfully." })
    };

  } catch (error: any) {
    console.error("Schema reset failed:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
