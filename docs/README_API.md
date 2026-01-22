# 🌵 Cactus Studio API Documentation

This technical guide details the serverless endpoints available in the Cactus Studio project.

## 🔑 Authentication

- **User Actions**: Most endpoints require a `sessionId` or a user token.
- **Admin Actions**: Any endpoint starting with `admin-` or modifying the database (e.g., `migrate-schema`) requires:
  `Authorization: Bearer <adminToken>`

## 📁 Request Categories

### Authentication & User Management

- `POST /register-user`: Create a new user account.
- `POST /login-user`: Authenticate and receive a session token.
- `POST /logout-user`: Invalidate the current session.
- `GET /get-user-data`: Retrieve profile and preferences.
- `POST /save-user-data`: Update user preferences.
- `POST /update-user-profile`: Update user profile details (name, etc.).
- `POST /change-password`: Change current user's password.
- `POST /request-password-reset`: Initiate password reset flow.
- `GET /check-reset-token`: Validate a reset token.
- `POST /reset-password-submit`: Complete password reset.
- `POST /verify-email`: Verify user email address.
- `POST /resend-verification`: Resend verification email.

### Storefront & Products

Endpoints for the public-facing gallery and filters.

- `GET /get-products`: Retrieve product catalog.
- `GET /get-discounts`: Returns active discount rules.
- `POST /validate-discount`: Check if a discount code is valid.
- `GET /get-plant-classes`: List available plant categories.
- `GET /get-public-settings`: Retrieve public configuration (e.g., maintenance mode).

### Orders & Checkout

- `POST /create-order`: Initializes the order in PostgreSQL.
- `POST /capture-order`: Validates payment and updates stock.
- `GET /get-order-items`: Retrieve items for a specific order.
- `GET /get-paypal-client-id`: Get public PayPal config.
- `POST /restore-preorder`: Restore an abandoned or specific order state.

### AI Plant Identification

Integration with multiple LLM providers.

- `POST /identify-plant-gemini`: Sends base64 image to Google Gemini.
- `POST /identify-plant-openai`: Sends base64 image to OpenAI Vision.
- `POST /identify-plant-grok`: Sends base64 image to Grok.
- `POST /identify-plant-kindwise`: Sends base64 image to Kindwise.
- `POST /identify-plant-ollama`: Sends base64 image to local Ollama instance.

### Uploads & Media

- `GET /get-cloudinary-config`: Get Cloudinary upload credentials.
- `POST /upload-image-signed`: Get a signed URL for direct upload.
- `POST /upload-images-to-cloudinary`: Upload multiple images.
- `POST /upload-to-google-drive`: Backup or store files in Drive.

### Admin & Database

Requires Admin Authentication.

- `POST /add-plant-class`: Add new plant categories.
- `POST /update-product`: Modify product details/inventory.
- `POST /update-order-status`: Change order status (e.g., shipped).
- `POST /cancel-order`: Cancel an existing order.
- `GET /get-pending-orders`: List orders requiring attention.
- `GET /get-users`: List registered users.
- `POST /migrate-schema`: Run database migrations.
- `POST /reset-schema`: Reset database schema (Destructive).
- `POST /seed-data`: Populate DB with initial data.
- `POST /backup-database`: Trigger a database backup.
- `POST /restore-database`: Restore database from backup.
- `POST /node-mailer`: Test email sending functionality.

## 🛠 Tools

Use the files in the `/docs` folder:

1. `test-endpoints.bat` (Windows)
2. `curl-examples.sh` (Linux/Mac)
3. `postman-collection.json` (Postman Import)
4. `openapi-full.json` (Swagger/OpenAPI Spec)
