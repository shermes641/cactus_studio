/**
 * Environment Configuration
 *
 * This file loads public settings from the server and exposes them on the
 * window.env object for global access.
 */

declare global {
  interface Window {
    env: {
      PAYPAL_SANDBOX_CLIENT_ID: string;
      EXCHANGE_RATE: number;
      SHIPPING_COST_CENTS: number;
      MIN_CART_SUBTOTAL_CENTS: number;
    };
  }
}

export async function loadEnvSettings() {
  // Set default values first
  window.env = {
    PAYPAL_SANDBOX_CLIENT_ID: 'AcmJhypFC4vPsDliPw-dFyklgWTFiPCvMGeyn6vvnfH0-pogwbS92nPbLQCbIiy5JUgW2q3LQZhc8cM7',
    EXCHANGE_RATE: 525, // Fallback
    SHIPPING_COST_CENTS: 667, // Fallback
    MIN_CART_SUBTOTAL_CENTS: 2000, // Fallback
  };

  try {
    const res = await fetch('/.netlify/functions/get-public-settings');
    const data = await res.json();
    if (data && !data.error) {
      Object.assign(window.env, data);
      console.log('Environment configuration updated from DB', window.env);
    }
  } catch (err) {
    console.warn('Failed to fetch environment settings, using defaults:', err);
  }
}
