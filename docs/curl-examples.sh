curl -X POST http://localhost:8888/.netlify/functions/add-plant-class -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/backup-database -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/cancel-order -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/capture-order -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/change-password -H "Content-Type: application/json" -d '{}'
curl http://localhost:8888/.netlify/functions/check-reset-token
curl -X POST http://localhost:8888/.netlify/functions/create-order -H "Content-Type: application/json" -d '{}'
curl http://localhost:8888/.netlify/functions/get-cloudinary-config
curl http://localhost:8888/.netlify/functions/get-discounts
curl http://localhost:8888/.netlify/functions/get-order-items
curl http://localhost:8888/.netlify/functions/get-paypal-client-id
curl http://localhost:8888/.netlify/functions/get-pending-orders
curl http://localhost:8888/.netlify/functions/get-plant-classes
curl http://localhost:8888/.netlify/functions/get-products
curl http://localhost:8888/.netlify/functions/get-public-settings
curl http://localhost:8888/.netlify/functions/get-user-data
curl http://localhost:8888/.netlify/functions/get-users
curl -X POST http://localhost:8888/.netlify/functions/identify-plant-gemini -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/identify-plant-grok -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/identify-plant-kindwise -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/identify-plant-ollama -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/identify-plant-openai -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/login-user -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/logout-user -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/migrate-schema -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/node-mailer -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/register-user -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/request-password-reset -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/resend-verification -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/reset-password-submit -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/reset-schema -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/restore-database -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/restore-preorder -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/save-user-data -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/seed-data -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/update-order-status -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/update-product -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/update-user-profile -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/upload-image-signed -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/upload-images-to-cloudinary -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/upload-to-google-drive -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/validate-discount -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8888/.netlify/functions/verify-email -H "Content-Type: application/json" -d '{}'