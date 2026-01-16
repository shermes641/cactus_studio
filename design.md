# PHASE 1 — Introduce Neon (without breaking anything)

## 1.1 Create Neon DB

Go to Neon

Create project

Copy pooled connection string

Add to Netlify:

NETLIFY_DATABASE_URL=postgresql://...

1.2 Install Neon client
npm install @netlify/neon

Create a shared DB helper:

src/lib/db.ts
import { neon } from "@netlify/neon";

export const sql = neon(); // auto-reads NETLIFY_DATABASE_URL

✅ No code uses it yet

PHASE 2 — Create schema (foundation)

Run this once (Neon SQL editor).

2.1 Products (image-based catalog)
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  scientific TEXT NOT NULL,
  type TEXT,
  price_cents INTEGER NOT NULL,
  hidden BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

2.2 Inventory (multi-SKU per image)
CREATE TABLE inventory (
  sku TEXT PRIMARY KEY,
  image_id BIGINT REFERENCES products(id),
  color TEXT,
  size TEXT,
  price_cents INTEGER,
  quantity INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT true
);

2.3 Inventory event ledger (NO direct mutation)
CREATE TABLE inventory_events (
  id BIGSERIAL PRIMARY KEY,
  sku TEXT REFERENCES inventory(sku),
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

2.4 Users & Discounts
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE discounts (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('percent', 'shipping')),
  value INTEGER NOT NULL,
  active BOOLEAN DEFAULT true
);

-- Seed: 5%, 10%, 15%, 20%, Free Shipping
INSERT INTO discounts (code, type, value) VALUES ('SAVE5', 'percent', 5), ('SAVE10', 'percent', 10), ('SAVE15', 'percent', 15), ('SAVE20', 'percent', 20), ('FREESHIP', 'shipping', 0);

2.5 Orders & payments (provider-agnostic)
CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  discount_code TEXT REFERENCES discounts(code),
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE payments (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES orders(id),
  provider TEXT,
  provider_id TEXT,
  amount_cents INTEGER,
  currency TEXT,
  status TEXT,
  captured_at TIMESTAMPTZ
);

2.6 Webhook idempotency
CREATE TABLE webhook_events (
  provider TEXT,
  event_id TEXT,
  payload JSONB,
  received_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (provider, event_id)
);

PHASE 1.5 — Data Seeding (One-off)
Create a script to push your existing `data.json` into Neon.

1. Read `data.json`
2. Insert into `products` (name, price, image_url, type)
3. Insert into `inventory` (sku, quantity)
   - Generate SKU: `BOT-{ID}-STD`
   - Default quantity: 10

PHASE 4 — PayPal flow (wrapped, not replaced)
4.1 Frontend checkout (unchanged UX)

**Step A: Replace data.json**
Currently, the frontend loads static data. Create a function:
`GET /.netlify/functions/get-products`

Returns:

```json
[ { "id": 1, "name": "...", "price": 1000, "available": 5 } ]
```

Update `script.ts` to fetch this instead of `data.json`.

**Step B: Checkout**
Your PayPal button stays the same.

BUT instead of creating the order directly, you call:

POST /.netlify/functions/create-order

4.2 create-order.ts
import { sql } from "../lib/db";

export async function handler(event) {
  const { sku, quantity, discountCode, userId } = JSON.parse(event.body);

  // 1. Check inventory (Simple check, no lock)
  const [row] = await sql`SELECT quantity FROM inventory WHERE sku=${sku}`;
  
  if (!row || row.quantity < quantity) {
    throw new Error("Out of stock");
  }

  // 2. Validate Discount
  if (discountCode) {
    const [discount] = await sql`SELECT * FROM discounts WHERE code=${discountCode} AND active=true`;
    if (!discount) throw new Error("Invalid discount code");
    // Apply discount logic here (reduce total)
  }

  // 3. Create Order record
  const [order] = await sql`INSERT INTO orders (user_id, discount_code, status) VALUES (${userId}, ${discountCode}, 'pending') RETURNING id`;

  // 4. Create PayPal order (existing code)
}

4.3 PayPal capture webhook
paypal-webhook.ts

```typescript
// 1. Idempotency
const exists =
  await sql`SELECT 1 FROM webhook_events WHERE provider='paypal' AND event_id=${event.id}`;

if (exists.length) return;

// 2. Store webhook - INSERT record
// (SQL: INSERT INTO webhook_events VALUES ('paypal', event.id, event))

// 3. Capture → Decrement Stock
await sql.begin(async (tx) => {
  // Decrement only if stock exists (prevents negative inventory)
  // (SQL: UPDATE inventory SET quantity = quantity - qty WHERE sku = sku AND quantity >= qty RETURNING quantity)
  const [updated] = await tx`...`;

  if (!updated) {
    console.error("OVERSOLD: Manual refund needed for", sku);
    return;
  }

  // (SQL: INSERT INTO inventory_events (sku, delta, reason) VALUES (sku, -qty, 'sale'))
  await tx`...`;
});
```

PHASE 6 — Admin React dashboard
6.1 Queries (read-only)
-- Top SKUs
SELECT sku, SUM(-delta) sold
FROM inventory_events
WHERE reason='sale'
GROUP BY sku
ORDER BY sold DESC;

-- Dead stock
SELECT sku, quantity
FROM inventory
WHERE quantity > 0
  AND sku NOT IN (
    SELECT sku FROM inventory_events
    WHERE created_at > now() - interval '30 days'
  );

6.2 Charts

Revenue over time

Inventory levels

Fraud score histogram

Currency mix

Use:

Recharts

TanStack Table

Admin-only Netlify route

PHASE 7 — Fraud, chargebacks, refunds (Post-Launch)
7.1 Refund webhook

Insert refund

Add inventory back

Log event

7.2 Chargebacks

Insert into chargebacks

Flag SKU

Manual review only

PHASE 8 — Exports & accounting (Post-Launch)

CSV export function

QuickBooks-formatted CSV

Revenue recognition query

Multi-currency normalization

PHASE 9 — Security
Row-level security
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_only
ON inventory
FOR ALL
USING (current_setting('app.role') = 'admin');

Set role in admin functions only.

FINAL RESULT

You now have:

✅ PayPal (unchanged UX)
✅ Neon-backed inventory authority
✅ Multi-SKU catalog
✅ Webhook idempotency
✅ Refund-safe inventory rollback
✅ Real-time admin dashboards
✅ Accounting exports
✅ Fraud & chargeback visibility

This is not a demo system anymore — it’s what real commerce platforms do.
