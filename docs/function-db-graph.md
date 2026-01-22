# Function → DB Usage Graph

```mermaid
flowchart LR

    Client -->|POST /api/orders| create-order
    create-order -->|INSERT| orders
    create-order -->|INSERT| order_items

    Client -->|POST /api/orders/capture| capture-order
    capture-order -->|UPDATE| orders
    capture-order -->|SELECT| order_items

    Client -->|PATCH /api/orders/status| update-order-status
    update-order-status -->|UPDATE| orders

    Client -->|POST /api/discounts/validate| validate-discount
    validate-discount -->|SELECT| discounts

    Client -->|POST /api/auth/login| login-user
    login-user -->|SELECT| users

    Client -->|POST /api/auth/register| register-user
    register-user -->|INSERT| users

    Client -->|PATCH /api/products| update-product
    update-product -->|UPDATE| products
