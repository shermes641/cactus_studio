import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const code = event.queryStringParameters?.code;
  const email = event.queryStringParameters?.email;

  if (!code) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Discount code is required' }) };
  }

  const connectionString = process.env.NETLIFY_DATABASE_URL;
  if (!connectionString) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Database connection failed' }) };
  }

  const sql = neon(connectionString);

  try {
    // If user is logged in, check their specific discounts
    if (email) {
      const userRes = await sql`SELECT discount_code FROM users WHERE email = ${email}`;
      if (userRes.length > 0) {
        const assignedCode = userRes[0].discount_code;
        
        if (!assignedCode) {
          return { statusCode: 400, body: JSON.stringify({ error: 'You have no active discounts' }) };
        }

        const allowed = assignedCode.toUpperCase() === code.toUpperCase();
        if (!allowed) {
           return { statusCode: 400, body: JSON.stringify({ error: 'Discount code not found in your account' }) };
        }
      }
    }

    const discounts = await sql`
      SELECT code, type, value, active FROM discounts WHERE UPPER(code) = UPPER(${code})
    `;

    if (discounts.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Discount code not found' }) };
    }

    const discount = discounts[0];
    if (!discount.active) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Discount code is not active' }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ discount })
    };

  } catch (error: any) {
    console.error('Discount validation error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Failed to validate discount' })
    };
  }
};