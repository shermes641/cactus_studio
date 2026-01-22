# Cactus System Diagrams

All system architecture, flows, and state machines for the Cactus platform.

---

## Checkout Flow (Order → PayPal → Capture)

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant CO as create-order
    participant PP as PayPal
    participant CAP as capture-order
    participant DB as PostgreSQL

    U->>FE: Click Checkout
    FE->>CO: POST /create-order
    CO->>DB: INSERT order + items
    CO->>PP: Create PayPal order
    PP-->>FE: approval_url

    U->>PP: Approve payment

    FE->>CAP: POST /capture-order
    CAP->>PP: Capture payment
    CAP->>DB: UPDATE order status=paid
    CAP-->>FE: Success
```

---

## Auth Flow (Register + Login + JWT)

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant REG as register-user
    participant LOG as login-user
    participant JWT as JWT Service
    participant DB as PostgreSQL

    U->>FE: Register
    FE->>REG: POST /register-user
    REG->>DB: INSERT user

    U->>FE: Login
    FE->>LOG: POST /login-user
    LOG->>DB: SELECT user
    LOG->>JWT: sign token
    JWT-->>FE: access token
```

---

## JWT Lifecycle

```mermaid
flowchart LR
    Login --> Issue[Issue JWT]
    Issue --> Store[Client stores token]
    Store --> Requests[Authenticated requests]
    Requests --> Verify[Server verifies JWT]
    Verify --> Expire[Expires]
    Expire --> Refresh[Login again]
```

---

## PayPal Payment State Machine

```mermaid
stateDiagram-v2
    [*] --> Created
    Created --> Approved
    Approved --> Captured
    Captured --> Completed
    Approved --> Cancelled
    Created --> Cancelled
```

---

## Component / Architecture Diagram

```mermaid
flowchart TB
    FE[Frontend / React]
    NF[Netlify Functions]
    DB[(PostgreSQL)]
    PP[PayPal API]
    AI[Plant AI Provider]

    FE --> NF
    NF --> DB
    NF --> PP
    NF --> AI
```

---

## Admin Flow

```mermaid
sequenceDiagram
    participant Admin
    participant UI as Admin UI
    participant API as update-product
    participant DB as PostgreSQL

    Admin->>UI: Edit product
    UI->>API: PATCH /update-product
    API->>DB: UPDATE products
    API-->>UI: Success
```

---

## Plant AI Provider Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as Netlify Function
    participant AI as Plant AI Provider

    U->>FE: Upload plant image
    FE->>API: POST /identify
    API->>AI: Send image
    AI-->>API: Species result
    API-->>FE: Prediction
```

---

## ER Diagram (Database Schema)

```mermaid
erDiagram
    users ||--o{ orders : places
    users ||--o{ audit_logs : generates
    orders ||--o{ order_items : contains
    orders ||--o{ payments : "paid by"
    products ||--o{ order_items : "ordered as"
    products ||--o{ inventory : "stored as"
    plant_classes ||--o{ products : categorizes
    inventory ||--o{ inventory_events : "tracked by"
    discounts ||--o{ orders : "applied to"
    discounts ||--o{ users : "assigned to"

    users {
        bigint id PK
        text email UK
        text password_hash
        text name
        text phone
        timestamp created_at
        text shipping_addr
        jsonb cart
        boolean is_admin
        boolean is_verified
        text verification_token
        text reset_token
        timestamp reset_token_expires
        timestamp verification_token_expires
        text discount_code FK
        text session_token
    }

    orders {
        bigint id PK
        bigint user_id FK
        text paypal_order_id
        text customer_email
        text customer_name
        text discount_code FK
        integer total_amount_cents
        text currency
        text status
        timestamp created_at
        text shipping_addr
        text receipt_url
        timestamp shipped_at
    }

    order_items {
        bigint id PK
        bigint order_id FK
        bigint product_id FK
        text name
        integer price_cents
        integer quantity
        text sku
    }

    products {
        bigint id PK
        text name
        text image_url
        text scientific
        text class FK
        integer price_cents
        text notes
        timestamp created_at
        text sku
    }

    inventory {
        text sku PK
        bigint image_id
        text color
        text size
        integer price_cents
        integer quantity
        boolean active
    }

    inventory_events {
        bigint id PK
        text sku FK
        integer delta
        text reason
        text ref
        timestamp created_at
    }

    payments {
        bigint id PK
        bigint order_id FK
        text provider
        text provider_payment_id
        integer amount_cents
        text currency
        text status
        timestamp captured_at
    }

    plant_classes {
        bigint id PK
        text name UK
    }

    discounts {
        text code PK
        text type
        integer value
        boolean active
    }

    audit_logs {
        uuid id PK
        bigint user_id FK
        text user_email
        text action
        text entity_type
        text entity_id
        boolean success
        text message
        inet ip_address
        text user_agent
        jsonb metadata
        timestamp created_at
    }

    settings {
        text key PK
        text value
        text type
    }

    statuses {
        text code PK
        text description
    }

    webhook_events {
        text provider
        text event_id
        jsonb payload
        timestamp received_at
    }

```
