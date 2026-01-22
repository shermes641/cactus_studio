# System Design

This document reflects the **actual current database schema and architecture**
detected directly from the codebase.  
It also lists staged improvements that can be added incrementally.

For diagrams → `docs/diagrams.md`

---

## Current Architecture

## Stack

- Netlify Functions (TypeScript)
- Neon PostgreSQL
- React + Tailwind
- PayPal Checkout
- Cloudinary storage
- Plant AI provider

## Responsibilities

Functions:

- auth
- orders
- payments
- products
- admin
- uploads

Database is the single source of truth.

---

## Database Schema (Auto-synced)

## ER Diagram

```mermaid
erDiagram

  USERS {
    bigint id PK
    text email
    text password_hash
    text name
    text phone
    text shipping_addr
    jsonb cart
    bool is_admin
    bool is_verified
    text verification_token
    timestamptz verification_token_expires
    text reset_token
    timestamptz reset_token_expires
    text session_token
    text discount_code FK
    timestamptz created_at
  }

  PRODUCTS {
    bigint id PK
    text name
    text image_url
    text scientific
    text class
    int price_cents
    text notes
    text sku
    timestamptz created_at
  }

  INVENTORY {
    text sku PK
    bigint image_id FK
    text color
    text size
    int price_cents
    int quantity
    bool active
  }

  INVENTORY_EVENTS {
    bigint id PK
    text sku FK
    int delta
    text reason
    text ref
    timestamptz created_at
  }

  DISCOUNTS {
    text code PK
    text type
    int value
    bool active
  }

  STATUSES {
    text code PK
    text description
  }

  ORDER_ITEMS {
    bigint id PK
    bigint order_id FK
    bigint product_id FK
    text name
    int price_cents
    int quantity
    text sku
  }

  ORDERS {
    bigint id PK
    bigint user_id FK
    text paypal_order_id
    text customer_email
    text customer_name
    text discount_code FK
    int total_amount_cents
    text status FK
    text shipping_addr
    text currency
    text receipt_url
    timestamptz shipped_at
    timestamptz created_at
  }

  PAYMENTS {
    bigint id PK
    bigint order_id FK
    text provider
    text provider_payment_id
    int amount_cents
    text currency
    text status
    timestamptz captured_at
  }

  PLANT_CLASSES {
    bigint id PK
    text name
  }

  AUDIT_LOGS {
    uuid id PK
    bigint user_id FK
    text user_email
    text action
    text entity_type
    text entity_id
    bool success
    text message
    inet ip_address
    text user_agent
    jsonb metadata
    timestamptz created_at
  }

  SETTINGS {
    text key PK
    text value
    text type
  }

  WEBHOOK_EVENTS {
    text provider
    text event_id
    jsonb payload
    timestamptz received_at
  }

  USERS ||--o{ ORDERS : places
  USERS ||--o{ AUDIT_LOGS : generates
  ORDERS ||--o{ PAYMENTS : has
  ORDERS ||--o{ ORDER_ITEMS : contains
  ORDERS }o--|| STATUSES : has_status
  PRODUCTS ||--o{ ORDER_ITEMS : included_in
  PRODUCTS ||--o{ INVENTORY : variants
  INVENTORY ||--o{ INVENTORY_EVENTS : logs
  DISCOUNTS ||--o{ ORDERS : applies
  DISCOUNTS ||--o{ USERS : assigned_to
```

---

## Runtime Flow

### Checkout

1. create-order
2. order stored in DB
3. PayPal order created
4. webhook confirms capture
5. inventory decremented inside transaction
6. inventory event logged

Inventory authority lives only in Neon.

---

## Staged Improvements Roadmap

These build on the current system safely.

---

### Phase 1 — Database Integrity & Performance

- **Indexes**:
  - `orders(user_id)` for fast customer history lookups.
  - `orders(created_at)` for sorting and reporting.
  - `inventory(sku)` for rapid stock checks.
  - `products(hidden)` for catalog filtering.
- **Constraints**:
  - Enforce `users.email` UNIQUE constraint.
  - Enforce `inventory.quantity >= 0` check constraint.
- **Foreign Keys**:
  - Ensure `ON DELETE RESTRICT` for `order_items -> products` to prevent deleting sold products.

---

### Phase 2 — Strong Inventory Guarantees

Prevent overselling using atomic database operations.

**Atomic Decrement:**

```sql
UPDATE inventory
SET quantity = quantity - $qty
WHERE sku = $sku
AND quantity >= $qty
RETURNING quantity;
```

Log:

```sql
INSERT INTO inventory_events (sku, delta, reason)
VALUES ($sku, -$qty, 'sale');
```

---

### Phase 3 — Admin Analytics

- top SKUs
- dead stock
- revenue charts
- fraud indicators

Stack:

- Recharts
- TanStack Table
- protected admin routes

---

### Phase 4 — Refunds & Chargebacks

Refund:

- add stock back
- inventory event (+qty)

Chargebacks:

- flag order
- manual review

---

### Phase 5 — Accounting

- CSV exports
- QuickBooks format
- currency normalization
- monthly revenue rollups

---

### Phase 6 — Security Hardening

- webhook signature verification
- JWT expiry rotation
- rate limiting
- row-level security
- admin-only policies

---

## Final State

Cactus operates as a production-grade commerce backend:

- Neon-backed authority
- append-only ledger
- idempotent webhooks
- refund-safe inventory
- analytics dashboards
- serverless scaling

No frontend UX changes required.
