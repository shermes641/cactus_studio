import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { email, token } = JSON.parse(event.body || '{}');
    if (!email || !token) return { statusCode: 400, body: JSON.stringify({ error: "Missing parameters" }) };

    const sql = neon(process.env.NETLIFY_DATABASE_URL!);
    
    // Fetch user verification details
    const users = await sql`SELECT id, verification_token, verification_token_expires, is_verified FROM users WHERE email = ${email}`;
    
    if (users.length === 0) return { statusCode: 404, body: JSON.stringify({ error: "User not found" }) };
    
    const user = users[0];
    
    if (user.is_verified) return { statusCode: 200, body: JSON.stringify({ message: "Email is already verified." }) };
    
    if (user.verification_token !== token) {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid verification token." }) };
    }
    
    if (user.verification_token_expires && new Date() > new Date(user.verification_token_expires)) {
        await sql`DELETE FROM users WHERE id = ${user.id}`;
        return { statusCode: 400, body: JSON.stringify({ error: "Verification link has expired. Your account has been removed. Please register again." }) };
    }
    
    await sql`UPDATE users SET is_verified = true, verification_token = null, verification_token_expires = null WHERE id = ${user.id}`;
    
    return { statusCode: 200, body: JSON.stringify({ message: "Email verified successfully!" }) };
  } catch (e: any) {
    console.error("Verification error:", e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Internal server error" }) };
  }
};