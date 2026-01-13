import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const handler: Handler = async (event: any, context: any) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { email, password, name, shipping_addr } = body;

    // Validate input
    if (!email || !password) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email and password are required' }) };
    }

    if (password.length < 6) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Password must be at least 6 characters' }) };
    }

    const connectionString = process.env.NETLIFY_DATABASE_URL;
    if (!connectionString) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Database connection failed' }) };
    }

    const sql = neon(connectionString);

    // Check if user already exists
    const existingUser = await sql('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.length > 0) {
      return { statusCode: 409, body: JSON.stringify({ error: 'Email already registered' }) };
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 5); // 5 days

    // Insert new user
    const result = await sql(
      'INSERT INTO users (email, password_hash, name, shipping_addr, cart, verification_token, verification_token_expires, is_verified) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, email, name, shipping_addr, cart',
      [email, hashed, name || null, shipping_addr || null, JSON.stringify([]), verificationToken, expiry.toISOString(), false]
    );

    // Trigger verification email
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
          name: name || 'Cactus Lover',
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
    }

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'User registered successfully',
        user: result[0],
        verificationLink,
        emailBody
      })
    };

  } catch (error: any) {
    console.error('Registration error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Registration failed' })
    };
  }
};
