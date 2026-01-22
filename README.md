# Cactus

Full-stack Netlify + TypeScript + PostgreSQL (Timescale) + PayPal + AI plant identification platform.

Includes:

- Serverless API (Netlify Functions)
- JWT authentication
- PayPal checkout
- Plant AI provider
- Admin dashboard
- PostgreSQL database
- Auto-generated OpenAPI docs
- Mermaid architecture diagrams

See diagrams → `docs/diagrams.md`

---

## Features

- Serverless backend (Netlify Functions)
- PostgreSQL persistence
- JWT auth
- PayPal payments
- Product catalog + orders
- Discount codes
- Plant identification AI
- Admin tools
- OpenAPI + Postman collection
- Curl examples

---

## Tech Stack

- Node.js
- TypeScript
- Netlify Functions

### Database Persistence

- PostgreSQL / TimescaleDB

### Frontend

- React
- Tailwind

### Integrations

- PayPal
- AI plant provider
- Email provider

---

## Project Structure

```text
.
├─ netlify/
│  └─ functions/
├─ docs/
│  ├─ diagrams.md
│  ├─ openapi-full.json
│  ├─ function-db-graph.md
│  └─ postman.json
├─ src/
├─ package.json
└─ README.md
```

---

## Local Development

### Install

```bash
npm install
```

### Run locally

```bash
netlify dev
```

Server:

```html
http://localhost:8888/.netlify/functions/*
```

---

## 2. Configure env

Create `.env` for local testing (these values are not committed to git, and most you can see in Netlify, otherwise get from .config.txt file):

```bash
PAYPAL_SANDBOX_CLIENT_ID=
PAYPAL_SANDBOX_CLIENT_SECRET=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox
NETLIFY_DATABASE_URL=
NEON_PROJECT_ID=
NEON_API_KEY=
CLOUDINARY_CLOUD=
CLOUDINARY_PRESET=
CLOUDINARY_PRESET_SIGNED=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_DRIVE_CACTUS_ID=
GOOGLE_DRIVE_RECEIPTS_ID=
PLANT_ID_API_KEY=
EXCHANGE_RATE=
EMAIL_TEST_MODE=
SHIPPING_COST_CENTS=
# !!!!! not currently used !!!!!
GEMINI_API_KEY=
GEMINI_CACTUS_API_KEY=
OPENAI_CACTUS_API_KEY=
XAI_API_KEY=not_yet_available
GMAIL_USER=
GMAIL_APP_PASSWORD=
# !!!!! not used !!!!!
```

---

## Netlify Functions (Auto-discovered)

All functions live in:

```text
netlify/functions/
```

They automatically expose:

```bash
/.netlify/functions/<filename>
```

Example:

```bash
create-order.ts
→ /.netlify/functions/create-order
```

---

## API Quick Examples

### Create order

```bash
curl -X POST http://localhost:8888/.netlify/functions/create-order \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":1,"qty":2}]}'
```

### Login

```bash
curl -X POST http://localhost:8888/.netlify/functions/login-user \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"pass"}'
```

### Capture PayPal

```bash
curl -X POST http://localhost:8888/.netlify/functions/capture-order
```

---

## OpenAPI Docs

Preview:

```bash
npx swagger-ui-watcher docs/openapi-full.json
```

---

## Postman

Import:

```bash
docs/postman.json
```

---

## Database

### ER Diagram

See:

```bash
docs/diagrams.md
```

### Example tables

```sql
users
orders
order_items
products
discounts
```

---

## Deployment (Netlify)

### 1. Install CLI

```bash
npm i -g netlify-cli
```

### 2. Login

```bash
netlify login
```

### 3. Deploy preview

```bash
netlify deploy
```

### 4. Deploy production

```bash
netlify deploy --prod
```

---

## Admin Flow

Admins can:

- manage products
- manage discounts
- view orders
- update statuses

Flow diagram → `docs/diagrams.md`

---

## Authentication

- Register
- Login
- JWT issued
- Token required for protected routes

Header:

```text
Authorization: Bearer <token>
```

---

## Payments

State machine:

```text
Created → Approved → Captured → Completed
```

Full diagram → `docs/diagrams.md`

---

## Plant Identification

Upload image → server → AI provider → species prediction returned.

---

## Developer Onboarding

### First time setup

```bash
npm install
netlify dev
```

### Add new function

Create:

```text
netlify/functions/my-function.ts
```

Export:

```ts
export const handler = async () => ({ statusCode: 200 });
```

Automatically available at:

```bash
/.netlify/functions/my-function
```

---

## Documentation

- Diagrams → `docs/diagrams.md`
- OpenAPI → `docs/openapi-full.json`
- Postman → `docs/postman.json`
- DB usage graph → `docs/function-db-graph.md`

---

## License

Internal / Private
