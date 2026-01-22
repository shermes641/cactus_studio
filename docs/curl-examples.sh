#!/bin/bash
# Cactus Studio API Test Suite - Unix/Git Bash Version
BASE_URL="http://localhost:8888/.netlify/functions"
ADMIN_TOKEN="your_admin_token_here"

echo "--- 🌵 TESTING CACTUS STUDIO ENDPOINTS ---"

# --- PRODUCTS & CONFIG ---
echo "Testing Product Endpoints..."
curl -X GET "$BASE_URL/get-products?page=1&limit=10"
curl -X GET "$BASE_URL/get-product-classes"
curl -X GET "$BASE_URL/get-discounts"
curl -X GET "$BASE_URL/get-paypal-client-id"
curl -X GET "$BASE_URL/get-shipping-rates"

# --- AUTHENTICATION & USER ---
echo "Testing Auth Endpoints..."
curl -X POST "$BASE_URL/register" -H "Content-Type: application/json" -d '{"email":"user@test.com","password":"Password123!","address":"San Jose, CR"}'
curl -X POST "$BASE_URL/login" -H "Content-Type: application/json" -d '{"email":"user@test.com","password":"Password123!"}'
curl -X POST "$BASE_URL/verify-email" -H "Content-Type: application/json" -d '{"token":"verification_token_here"}'
curl -X POST "$BASE_URL/request-password-reset" -H "Content-Type: application/json" -d '{"email":"user@test.com"}'
curl -X POST "$BASE_URL/reset-password" -H "Content-Type: application/json" -d '{"token":"reset_token","newPassword":"NewPassword123!"}'

# --- SHOPPING CART & ORDERS ---
echo "Testing Order Endpoints..."
curl -X POST "$BASE_URL/add-to-cart" -H "Content-Type: application/json" -d '{"productId":"1", "sessionId":"test_session"}'
curl -X POST "$BASE_URL/get-cart" -H "Content-Type: application/json" -d '{"sessionId":"test_session"}'
curl -X POST "$BASE_URL/create-order" -H "Content-Type: application/json" -d '{"items":[{"id":1,"qty":1}],"email":"user@test.com"}'
curl -X GET "$BASE_URL/get-orders?email=user@test.com"
curl -X POST "$BASE_URL/capture-paypal-order" -H "Content-Type: application/json" -d '{"orderID":"PAYPAL_ID"}'

# --- AI PLANT IDENTIFICATION ---
echo "Testing AI Endpoints..."
curl -X POST "$BASE_URL/identify-plant-gemini" -H "Content-Type: application/json" -d '{"image":"base64_string_here"}'
curl -X POST "$BASE_URL/identify-plant-openai" -H "Content-Type: application/json" -d '{"image":"base64_string_here"}'
curl -X POST "$BASE_URL/identify-plant-kindwise" -H "Content-Type: application/json" -d '{"image":"base64_string_here"}'

# --- ADMIN & DATABASE OPERATIONS ---
echo "Testing Admin Endpoints..."
curl -X POST "$BASE_URL/migrate-schema" -H "Authorization: Bearer $ADMIN_TOKEN"
curl -X POST "$BASE_URL/seed-data" -H "Authorization: Bearer $ADMIN_TOKEN"
curl -X POST "$BASE_URL/sync-database" -H "Authorization: Bearer $ADMIN_TOKEN"
curl -X POST "$BASE_URL/backup-database" -H "Authorization: Bearer $ADMIN_TOKEN"
curl -X GET "$BASE_URL/admin-get-all-orders" -H "Authorization: Bearer $ADMIN_TOKEN"

echo "--- ✅ TEST SUITE COMPLETE ---"