# Cactus Project

Modern full-stack app using Netlify Functions, TypeScript frontend, Neon/Postgres, PayPal, email, and AI plant identification.

---

## Documentation

* API Spec → `docs/openapi.yaml`
* Diagrams → `docs/diagrams.md`
* Function dependencies → `docs/function-dependencies.md`

---

## Setup

```bash
npm install
netlify dev
```

---

## Deployment (Netlify)

```bash
netlify login
netlify deploy --build
netlify deploy --prod
```

---

## Environment Variables

```env
DATABASE_URL=
PAYPAL_CLIENT_ID=
PAYPAL_SECRET=
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
CLOUDINARY_URL=
OPENAI_API_KEY=
```

---

## Functions

All server endpoints live in:

```text
/netlify/functions/*
```

Each file automatically becomes:

```text
/.netlify/functions/<filename>
```

---

## Contributing

```bash
npm run build
npm run lint
```

---

End of README
