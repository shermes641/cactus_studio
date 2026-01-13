import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';
import crypto from 'crypto';

export const handler: Handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { email } = JSON.parse(event.body || '{}');
    if (!email) return { statusCode: 400, body: JSON.stringify({ error: "Email required" }) };

    const sql = neon(process.env.NETLIFY_DATABASE_URL!);
    
    // Check user exists
    const users = await sql`SELECT id, name FROM users WHERE email = ${email}`;
    if (users.length === 0) {
        // Return success even if user not found to prevent enumeration
        return { statusCode: 200, body: JSON.stringify({ message: "If account exists, email sent." }) };
    }
    
    const user = users[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 1); // 1 day

    await sql`UPDATE users SET reset_token = ${token}, reset_token_expires = ${expiry.toISOString()} WHERE id = ${user.id}`;

    // Send email
    const siteUrl = process.env.URL || 'http://localhost:8888';
    let resetLink;
    let emailBody;

    try {
      const mailRes = await fetch(`${siteUrl}/.netlify/functions/node-mailer`, {
        method: 'POST',
        body: JSON.stringify({
          email,
          token,
          type: 'reset',
          name: user.name || 'Cactus Lover',
          test: process.env.EMAIL_TEST_MODE === 'true'
        })
      });

      if (process.env.EMAIL_TEST_MODE === 'true' && mailRes.ok) {
        const mailData = await mailRes.json();
        resetLink = mailData.link;
        emailBody = mailData.html;
      }
    } catch (e) {
      console.error("Failed to send reset email:", e);
      return { statusCode: 500, body: JSON.stringify({ error: "Failed to send email" }) };
    }

    return { statusCode: 200, body: JSON.stringify({ message: "Reset link sent", resetLink, emailBody }) };

  } catch (e: any) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};