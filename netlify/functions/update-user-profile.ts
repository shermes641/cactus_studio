import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { email, name, phone, shipping_addr, discount_code } = JSON.parse(event.body || '{}');
    if (!email) return { statusCode: 400, body: JSON.stringify({ error: "Email required" }) };

    const sql = neon(process.env.NETLIFY_DATABASE_URL!);
    
    // Check if user exists
    const users = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (users.length === 0) return { statusCode: 404, body: JSON.stringify({ error: "User not found" }) };

    if (discount_code !== undefined) {
        // Validate discount code exists if not null
        if (discount_code) {
             const d = await sql`SELECT code FROM discounts WHERE code = ${discount_code}`;
             if (d.length === 0) return { statusCode: 400, body: JSON.stringify({ error: "Invalid discount code" }) };
        }

        await sql`
            UPDATE users 
            SET name = ${name}, phone = ${phone}, shipping_addr = ${shipping_addr}, discount_code = ${discount_code}
            WHERE email = ${email}
        `;
    } else {
        await sql`
            UPDATE users 
            SET name = ${name}, phone = ${phone}, shipping_addr = ${shipping_addr}
            WHERE email = ${email}
        `;
    }
    
    const updatedUser = await sql`SELECT id, email, name, phone, shipping_addr, cart, is_admin, discount_code FROM users WHERE email = ${email}`;
    
    return { statusCode: 200, body: JSON.stringify({ message: "Profile updated", user: updatedUser[0] }) };

  } catch (e: any) {
    console.error("Update profile error:", e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};