import { Handler } from "@netlify/functions";

export const handler: Handler = async (event, context) => {
  // Allow fetching from either variable name for flexibility
  const clientId = process.env.PAYPAL_CLIENT_ID || process.env.PAYPAL_SANDBOX_CLIENT_ID;
  
  if (!clientId) {
    return { statusCode: 500, body: JSON.stringify({ error: "PayPal Client ID not configured in environment." }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ clientId })
  };
};