For Lily

# 🌵 The Cactus Studio - E-Commerce Frontend

A simple, single-page e-commerce frontend for a fictional cactus shop. This project is built with vanilla HTML, CSS, and JavaScript, demonstrating dynamic product rendering, a shopping cart, and a complete admin panel for product management.

## Features

### User-Facing Features

*   **Product Catalog:** Displays a grid of available cacti, loaded from a `data.json` file.
*   **Image Zoom:** Click on any product image to view a larger version in a full-screen modal.
*   **Shopping Cart:**
    *   Add items to a persistent shopping cart.
    *   View cart contents in a sliding sidebar.
    *   Remove items from the cart.
    *   The cart total is calculated automatically.
*   **User Persistence:** A simple login system using a phone number as a unique identifier ensures that each user's cart is saved in their browser's `localStorage`.

### Admin Features

*   **Protected Access:** Admin mode is accessed by navigating to the site with `#admin` in the URL and entering a password (`LILY`).
*   **Product CRUD (Create, Read, Update, "Delete"):**
    *   **Add Products:** An "Add Item" modal allows admins to add new cacti to the inventory by providing a name, price, and image URL.
    *   **Edit Products:** Clicking a product image while in admin mode opens an edit modal, pre-filled with the product's current details.
    *   **Hide/Unhide Products:** Instead of deleting, products can be "hidden". Hidden products are not visible in the main store and are automatically removed from user carts.
*   **Hidden Product Manager:** A dedicated modal lists all hidden products, allowing the admin to easily un-hide them and make them available for sale again. A badge in the header shows the count of hidden items.
*   **Data Persistence:** All admin changes (new products, edits, hidden status) are saved to `localStorage` under the admin's unique profile.

## How to Use

1.  **Run the Application:** Simply open the `index.html` file in a web browser.
2.  **Log In:** You will be prompted to enter a phone number to simulate a user login. This creates a unique session for your cart.
3.  **Access Admin Mode:**
    *   Navigate to the URL and append `#admin` to the end (e.g., `file:///.../index.html#admin`).
    *   When prompted, enter the password: `LILY`.
    *   The admin controls ("Add Item", "Hidden") will appear in the header.

## Technical Details

*   **Frontend:** Built entirely with vanilla HTML5, CSS3, and JavaScript (ES6+).
*   **Styling:** Uses modern CSS features like Flexbox, Grid, and CSS variables for theming.
*   **Data Handling:**
    *   Initial product data is fetched from a local `data.json` file.
    *   User cart and product list modifications are persisted in the browser's `localStorage`. Each user (identified by their "login" number) and the admin have their own separate data stored.
*   **No Backend:** This is a pure frontend application with no server-side logic or database. The "checkout" functionality is a placeholder.

## Paypal Integration

o use the PayPal SDK for live payments, you need a PayPal Business account. Here is the information on where to go and the associated costs.

1. Where to Sign Up
You need to go to the PayPal Developer Dashboard.

URL: https://developer.paypal.com/
Process:
Click "Log into Dashboard" at the top right.
You can log in with your existing personal PayPal account and upgrade it, or create a new Business Account specifically for your store.
Once logged in, go to "Apps & Credentials" to generate the Client ID needed for your code.

2. How Much Does It Cost?
Setting up the account and using the SDK is free. PayPal makes money only when you successfully sell something.

Monthly Fee: $0.00. There is no monthly subscription cost for the standard "Smart Payment Buttons" integration used in your code.
Setup Fee: $0.00. Generating Client IDs and accessing the API is free.
Transaction Fee: You are charged a percentage of every sale.
Standard Rate (USA): Approximately 2.99% + $0.49 per transaction.
Note: These rates vary by country and currency. International transactions usually have a slightly higher percentage (e.g., +1.50%).
Summary
You do not pay anything upfront. You only pay a small fee deducted automatically from the payment when a customer actually buys a cactus