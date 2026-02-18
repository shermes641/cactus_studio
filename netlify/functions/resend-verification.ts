import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';
import crypto from 'crypto';

export const handler: Handler = async (event: any, context: any) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { email } = JSON.parse(event.body);
    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email is required' }) };
    }

    const connectionString = process.env.NETLIFY_DATABASE_URL;
    if (!connectionString) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Database connection failed' }) };
    }

    const sql = neon(connectionString);

    // Check if user exists and is not verified
    const users = await sql`SELECT id, name, is_verified FROM users WHERE email = ${email}`;
    
    if (users.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };
    }

    const user = users[0];
    if (user.is_verified) {
      return { statusCode: 400, body: JSON.stringify({ error: 'User is already verified' }) };
    }

    // Generate new token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 5); // 5 days

    // Update DB
    await sql`
      UPDATE users SET verification_token = ${verificationToken}, verification_token_expires = ${expiry.toISOString()} WHERE id = ${user.id}
    `;

    // Send email
    const siteUrl = process.env.URL || 'http://localhost:8888';
    let verificationLink;
    let emailBody;

    try {
      const mailRes = await fetch(`${siteUrl}/.netlify/functions/node-mailer`, {
        method: 'POST',
        body: JSON.stringify({
          email,
          token: verificationToken,
          type: 'verify',
          name: user.name || 'Cactus Lover',
          test: process.env.EMAIL_TEST_MODE === 'true'
        })
      });

      if (process.env.EMAIL_TEST_MODE === 'true' && mailRes.ok) {
        const mailData = await mailRes.json();
        verificationLink = mailData.link;
        emailBody = mailData.html;
      }
    } catch (e) {
      console.error("Failed to send verification email:", e);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send email' }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Verification code sent', verificationLink, emailBody })
    };

  } catch (error: any) {
    console.error('Resend verification error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Failed to resend verification' }) };
  }
};