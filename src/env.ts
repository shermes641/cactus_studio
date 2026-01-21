/**
 * Environment Configuration
 *
 * This file exposes environment-specific variables to the browser window object.
 * It is used to inject configuration like API keys without hardcoding them
 * directly into the main application logic.
 */

interface Window {
  env: {
    PAYPAL_SANDBOX_CLIENT_ID: string;
    EXCHANGE_RATE?: number;
    SHIPPING_COST_CENTS?: number;
    MIN_CART_SUBTOTAL_CENTS?: number;
  };
}

window.env = {
  PAYPAL_SANDBOX_CLIENT_ID: "window no!!!!!!",//"AcmJhypFC4vPsDliPw-dFyklgWTFiPCvMGeyn6vvnfH0-pogwbS92nPbLQCbIiy5JUgW2q3LQZhc8cM7",
  EXCHANGE_RATE: 25,
  SHIPPING_COST_CENTS: 67,
  MIN_CART_SUBTOTAL_CENTS: 20
};

fetch('/.netlify/functions/get-public-settings')
  .then(res => res.json())
  .then(data => {
    if (data && !data.error) {
      Object.assign(window.env, data);
      console.log('Environment configuration updated from DB', window.env);
      window.dispatchEvent(new CustomEvent('env-updated'));
    }
  })
  .catch(err => console.warn('Failed to fetch environment settings:', err));
