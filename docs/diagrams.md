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
    orders ||--o{ order_items : contains
    products ||--o{ order_items : referenced_by
    discounts ||--o{ orders : applied_to

    users {
        int id PK
        text email
        text password_hash
        timestamp created_at
    }

    orders {
        int id PK
        int user_id FK
        text status
        timestamp created_at
    }

    order_items {
        int id PK
        int order_id FK
        int product_id FK
        int qty
    }

    products {
        int id PK
        text name
        numeric price
    }

    discounts {
        int id PK
        text code
        int percent
    }
```

---

## Function → Database Usage

```mermaid
flowchart LR

    create-order -->|INSERT| orders
    create-order -->|INSERT| order_items

    capture-order -->|UPDATE| orders

    update-order-status -->|UPDATE| orders

    login-user -->|SELECT| users
    register-user -->|INSERT| users

    validate-discount -->|SELECT| discounts

    update-product -->|UPDATE| products
```
