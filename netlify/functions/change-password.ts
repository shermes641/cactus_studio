import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';
import bcrypt from 'bcryptjs';

export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { email, currentPassword, newPassword } = JSON.parse(event.body || '{}');
    if (!email || !currentPassword || !newPassword) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing fields" }) };
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Password must be at least 8 characters, with 1 uppercase, 1 number, and 1 special char" }) };
    }

    const sql = neon(process.env.NETLIFY_DATABASE_URL!);
    
    const users = await sql`SELECT id, password_hash FROM users WHERE email = ${email}`;
    
    if (users.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: "User not found" }) };
    }
    
    const user = users[0];
    
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      return { statusCode: 401, body: JSON.stringify({ error: "Incorrect current password" }) };
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    
    await sql`UPDATE users SET password_hash = ${hashed} WHERE id = ${user.id}`;
    
    return { statusCode: 200, body: JSON.stringify({ message: "Password updated successfully" }) };

  } catch (e: any) {
    console.error("Change password error:", e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Internal server error" }) };
  }
};