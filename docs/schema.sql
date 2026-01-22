-- Create tables for Neon Database Schema

-- Users table
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    shipping_addr TEXT,
    cart JSONB DEFAULT '[]'::jsonb,
    is_admin BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    verification_token TEXT,
    reset_token TEXT,
    reset_token_expires TIMESTAMP WITH TIME ZONE,
    verification_token_expires TIMESTAMP WITH TIME ZONE,
    discount_code TEXT,
    session_token TEXT
);

-- Plant classes table
CREATE TABLE plant_classes (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- Products table
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    scientific TEXT NOT NULL,
    class TEXT REFERENCES plant_classes(name),
    price_cents INTEGER NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sku TEXT
);

-- Inventory table
CREATE TABLE inventory (
    sku TEXT PRIMARY KEY,
    image_id BIGINT,
    color TEXT,
    size TEXT,
    price_cents INTEGER,
    quantity INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN DEFAULT true
);

-- Inventory events table
CREATE TABLE inventory_events (
    id BIGSERIAL PRIMARY KEY,
    sku TEXT REFERENCES inventory(sku),
    delta INTEGER NOT NULL,
    reason TEXT,
    ref TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Discounts table
CREATE TABLE discounts (
    code TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    value INTEGER NOT NULL,
    active BOOLEAN DEFAULT true
);

-- Orders table
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    paypal_order_id TEXT,
    customer_email TEXT,
    customer_name TEXT,
    discount_code TEXT REFERENCES discounts(code),
    total_amount_cents INTEGER,
    currency TEXT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    shipping_addr TEXT,
    receipt_url TEXT,
    shipped_at TIMESTAMP WITH TIME ZONE
);

-- Order items table
CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id),
    product_id BIGINT REFERENCES products(id),
    name TEXT,
    price_cents INTEGER,
    quantity INTEGER,
    sku TEXT
);

-- Payments table
CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id),
    provider TEXT,
    provider_payment_id TEXT,
    amount_cents INTEGER,
    currency TEXT,
    status TEXT,
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT REFERENCES users(id),
    user_email TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    success BOOLEAN NOT NULL DEFAULT true,
    message TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Settings table
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    type TEXT DEFAULT 'string'::text
);

-- Statuses table
CREATE TABLE statuses (
    code TEXT PRIMARY KEY,
    description TEXT
);

-- Webhook events table
CREATE TABLE webhook_events (
    provider TEXT NOT NULL,
    event_id TEXT NOT NULL,
    payload JSONB,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (provider, event_id)
);

-- Add foreign key constraint for users discount_code
ALTER TABLE users 
ADD CONSTRAINT users_discount_code_fkey 
FOREIGN KEY (discount_code) REFERENCES discounts(code);

-- Create indexes for better query performance
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_inventory_events_sku ON inventory_events(sku);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_session_token ON users(session_token);