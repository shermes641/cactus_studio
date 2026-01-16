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
  };
}

window.env = {
  PAYPAL_SANDBOX_CLIENT_ID:"AcmJhypFC4vPsDliPw-dFyklgWTFiPCvMGeyn6vvnfH0-pogwbS92nPbLQCbIiy5JUgW2q3LQZhc8cM7",
  EXCHANGE_RATE: 525,
};
