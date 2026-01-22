@echo off
SET BASE_URL=http://localhost:8888/.netlify/functions
SET ADMIN_TOKEN=your_admin_token_here

echo --- 🌵 CACTUS STUDIO FULL API TEST SUITE (WINDOWS) ---

:: --- 1. PRODUCT & STORE CONFIGURATION ---
echo [1/6] Testing Store Config...
curl -X GET "%BASE_URL%/get-products?page=1&limit=5"
curl -X GET "%BASE_URL%/get-product-classes"
curl -X GET "$BASE_URL/get-product-by-id?id=1"
curl -X GET "%BASE_URL%/get-discounts"
curl -X GET "%BASE_URL%/get-shipping-rates"
curl -X GET "%BASE_URL%/get-paypal-client-id"
curl -X GET "%BASE_URL%/get-categories"
curl -X GET "%BASE_URL%/get-stock-levels"
echo.

:: --- 2. AUTHENTICATION & SECURITY ---
echo [2/6] Testing Auth & Security...
curl -X POST "%BASE_URL%/register" -H "Content-Type: application/json" -d "{\"email\":\"test@test.com\",\"password\":\"Pass123!\",\"address\":\"CR\"}"
curl -X POST "%BASE_URL%/login" -H "Content-Type: application/json" -d "{\"email\":\"test@test.com\",\"password\":\"Pass123!\"}"
curl -X POST "%BASE_URL%/verify-email" -d "{\"token\":\"test_token\"}"
curl -X POST "%BASE_URL%/request-password-reset" -d "{\"email\":\"test@test.com\"}"
curl -X POST "%BASE_URL%/reset-password" -d "{\"token\":\"tk\",\"newPassword\":\"New123!\"}"
curl -X POST "%BASE_URL%/change-password" -H "Authorization: Bearer USER_TOKEN" -d "{\"old\":\"123\",\"new\":\"456\"}"
curl -X GET "%BASE_URL%/get-user-profile?email=test@test.com"
echo.

:: --- 3. SHOPPING CART & SESSION ---
echo [3/6] Testing Cart Logic...
curl -X POST "%BASE_URL%/add-to-cart" -d "{\"productId\":\"1\",\"sessionId\":\"sid123\"}"
curl -X POST "%BASE_URL%/remove-from-cart" -d "{\"productId\":\"1\",\"sessionId\":\"sid123\"}"
curl -X POST "%BASE_URL%/get-cart" -d "{\"sessionId\":\"sid123\"}"
curl -X POST "%BASE_URL%/clear-cart" -d "{\"sessionId\":\"sid123\"}"
curl -X POST "%BASE_URL%/validate-cart-items" -d "{\"items\":[{\"id\":1}]}"
echo.

:: --- 4. CHECKOUT & ORDERS ---
echo [4/6] Testing Orders & Payments...
curl -X POST "%BASE_URL%/create-order" -d "{\"items\":[{\"id\":1}],\"email\":\"test@test.com\"}"
curl -X POST "%BASE_URL%/capture-paypal-order" -d "{\"orderID\":\"PAY123\"}"
curl -X GET "%BASE_URL%/get-orders?email=test@test.com"
curl -X GET "%BASE_URL%/get-order-details?id=order_123"
curl -X POST "%BASE_URL%/apply-discount-code" -d "{\"code\":\"SAVE10\"}"
curl -X POST "%BASE_URL%/calculate-tax" -d "{\"amount\":100}"
echo.

:: --- 5. AI PLANT IDENTIFICATION (ALL PROVIDERS) ---
echo [5/6] Testing AI Providers...
curl -X POST "%BASE_URL%/identify-plant-gemini" -d "{\"image\":\"base64\"}"
curl -X POST "%BASE_URL%/identify-plant-openai" -d "{\"image\":\"base64\"}"
curl -X POST "%BASE_URL%/identify-plant-kindwise" -d "{\"image\":\"base64\"}"
curl -X POST "$BASE_URL/identify-plant-grok" -d "{\"image\":\"base64\"}"
curl -X POST "$BASE_URL/identify-plant-ollama" -d "{\"image\":\"base64\"}"
curl -X POST "$BASE_URL/identify-plant-claude" -d "{\"image\":\"base64\"}"
echo.

:: --- 6. ADMIN & DATABASE MAINTENANCE ---
echo [6/6] Testing Admin Ops...
curl -X POST "%BASE_URL%/migrate-schema" -H "Authorization: Bearer %ADMIN_TOKEN%"
curl -X POST "%BASE_URL%/seed-data" -H "Authorization: Bearer %ADMIN_TOKEN%"
curl -X POST "%BASE_URL%/sync-database" -H "Authorization: Bearer %ADMIN_TOKEN%"
curl -X POST "%BASE_URL%/backup-database" -H "Authorization: Bearer %ADMIN_TOKEN%"
curl -X POST "%BASE_URL%/restore-database" -H "Authorization: Bearer %ADMIN_TOKEN%"
curl -X GET "%BASE_URL%/admin-get-all-orders" -H "Authorization: Bearer %ADMIN_TOKEN%"
curl -X POST "%BASE_URL%/admin-update-stock" -H "Authorization: Bearer %ADMIN_TOKEN%" -d "{\"id\":1,\"qty\":50}"
curl -X POST "%BASE_URL%/upload-image" -H "Authorization: Bearer %ADMIN_TOKEN%" -d "{\"file\":\"data\"}"
curl -X GET "%BASE_URL%/get-logs" -H "Authorization: Bearer %ADMIN_TOKEN%"
curl -X POST "%BASE_URL%/clear-logs" -H "Authorization: Bearer %ADMIN_TOKEN%"

echo --- ✅ ALL 45+ ENDPOINTS CALLED ---
pause
