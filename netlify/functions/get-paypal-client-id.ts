import { Handler } from "@netlify/functions";

export const handler: Handler = async (event: any, context: any) => {
  // Allow fetching from either variable name for flexibility
  const paypalMode = process.env.PAYPAL_MODE || "sandbox";
  const clientId = paypalMode === "live" ? process.env.PAYPAL_CLIENT_ID : process.env.PAYPAL_SANDBOX_CLIENT_ID;
  
  if (!clientId) {
    return { statusCode: 500, body: JSON.stringify({ error: "PayPal Client ID not configured in environment." }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ clientId, paypalMode })
  };
};
