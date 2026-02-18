/**
 * This file contains the canonical SQL schema definitions.
 * It is used by `reset-schema.ts` to create the database from scratch,
 * and by `migrate-schema.ts` to create missing tables.
 */

// Note: These are without "IF NOT EXISTS" for use in reset-schema,
// which drops tables first. Migrations should add "IF NOT EXISTS".

export const CREATE_PRODUCTS_TABLE = `
      CREATE TABLE products (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        image_url TEXT NOT NULL,
        scientific TEXT NOT NULL,
        class TEXT,
        price_cents INTEGER NOT NULL,
        notes TEXT,
        sku TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

export const CREATE_INVENTORY_TABLE = `
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

export const CREATE_INVENTORY_EVENTS_TABLE = `
      CREATE TABLE inventory_events (
        id BIGSERIAL PRIMARY KEY,
        sku TEXT REFERENCES inventory(sku),
        delta INTEGER NOT NULL,
        reason TEXT NOT NULL,
        ref TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

export const CREATE_DISCOUNTS_TABLE = `
      CREATE TABLE discounts (
        code TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('percent', 'shipping')),
        value INTEGER NOT NULL,
        active BOOLEAN DEFAULT true
      )
    `;

export const CREATE_USERS_TABLE = `
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
        session_token TEXT,
        discount_code TEXT REFERENCES discounts(code),
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

export const CREATE_AUDIT_LOGS_TABLE = `
      CREATE TABLE audit_logs (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
        user_email    TEXT NULL,
        action        TEXT NOT NULL,
        entity_type   TEXT NULL,
        entity_id     TEXT NULL,
        success       BOOLEAN NOT NULL DEFAULT true,
        message       TEXT NULL,
        ip_address    INET NULL,
        user_agent    TEXT NULL,
        metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

export const CREATE_STATUSES_TABLE = `
      CREATE TABLE statuses (
        code TEXT PRIMARY KEY,
        description TEXT
      )
    `;

export const CREATE_PLANT_CLASSES_TABLE = `
      CREATE TABLE plant_classes (
        id BIGSERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      )
    `;

export const CREATE_SETTINGS_TABLE = `
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        type TEXT DEFAULT 'string'
      )
    `;

export const CREATE_ORDERS_TABLE = `
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
        shipping_addr TEXT,
        receipt_url TEXT,
        shipped_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

export const CREATE_ORDER_ITEMS_TABLE = `
      CREATE TABLE order_items (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT REFERENCES orders(id),
        product_id BIGINT REFERENCES products(id),
        name TEXT,
        sku TEXT,
        price_cents INTEGER,
        quantity INTEGER
      )
    `;

export const CREATE_PAYMENTS_TABLE = `
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

export const CREATE_WEBHOOK_EVENTS_TABLE = `
      CREATE TABLE webhook_events (
        provider TEXT,
        event_id TEXT,
        payload JSONB,
        received_at TIMESTAMPTZ DEFAULT now(),
        PRIMARY KEY (provider, event_id)
      )
    `;

export const SEED_DISCOUNTS = `
      INSERT INTO discounts (code, type, value) VALUES 
      ('SAVE5', 'percent', 5), 
      ('SAVE10', 'percent', 10), 
      ('SAVE15', 'percent', 15), 
      ('SAVE20', 'percent', 20), 
      ('FREESHIP', 'shipping', 0)
      ON CONFLICT (code) DO NOTHING
    `;

export const SEED_PLANT_CLASSES = `
      INSERT INTO plant_classes (name) VALUES 
      ('Opuntia'), ('Euphorbia'), ('Mammillaria'), ('Aizoaceae'), 
      ('Aloe'), ('Crassula'), ('Echeveria'), ('Haworthia'), 
      ('Sansevieria'), ('Sedum'), ('Sempervivum')
      ON CONFLICT (name) DO NOTHING
    `;

export const SEED_STATUSES = `
      INSERT INTO statuses (code, description) VALUES 
      ('cancelled', 'cancelled'), 
      ('manual_verification', 'manual_verification'), 
      ('pending', 'pending'), 
      ('processing', 'processing'), 
      ('refunded', 'refunded'), 
      ('shipped', 'shipped'), 
      ('pre_order', 'pre_order')
      ON CONFLICT (code) DO NOTHING
    `;

export const SEED_SETTINGS = `
      INSERT INTO settings (key, value, type) VALUES 
      ('PAYPAL_SANDBOX_CLIENT_ID', 'AcmJhypFC4vPsDliPw-dFyklgWTFiPCvMGeyn6vvnfH0-pogwbS92nPbLQCbIiy5JUgW2q3LQZhc8cM7', 'string'),
      ('EXCHANGE_RATE', '525', 'number'),
      ('SHIPPING_COST_CENTS', '667', 'number'),
      ('MIN_CART_SUBTOTAL_CENTS', '2000', 'number')
      ON CONFLICT (key) DO NOTHING
    `;

export const UPDATE_SETTINGS_TYPES = `
      UPDATE settings SET type = 'number' WHERE key IN ('EXCHANGE_RATE', 'SHIPPING_COST_CENTS', 'MIN_CART_SUBTOTAL_CENTS') AND type != 'number'
    `;

// In dependency order for creation
export const creationOrder = [
  CREATE_PRODUCTS_TABLE,
  CREATE_DISCOUNTS_TABLE,
  CREATE_STATUSES_TABLE,
  CREATE_PLANT_CLASSES_TABLE,
  CREATE_SETTINGS_TABLE,
  CREATE_USERS_TABLE,
  CREATE_INVENTORY_TABLE,
  CREATE_INVENTORY_EVENTS_TABLE,
  CREATE_AUDIT_LOGS_TABLE,
  CREATE_ORDERS_TABLE,
  CREATE_ORDER_ITEMS_TABLE,
  CREATE_PAYMENTS_TABLE,
  CREATE_WEBHOOK_EVENTS_TABLE,
];

// In reverse dependency order for dropping
export const dropOrder = [
  'webhook_events',
  'payments',
  'order_items',
  'audit_logs',
  'inventory_events',
  'orders',
  'inventory',
  'users',
  'user_discounts', // obsolete but let's keep it for cleanup
  'discounts',
  'products',
  'statuses',
  'plant_classes',
  'settings',
];