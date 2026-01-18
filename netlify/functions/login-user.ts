import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Buffer } from 'buffer';

export const handler: Handler = async (event: any, context: any) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { email, password } = body;

    if (!email || !password) {
      console.error('Login error: Email and password are required');
      return { statusCode: 400, body: JSON.stringify({ error: 'Email and password are required' }) };
    }

    const connectionString = process.env.NETLIFY_DATABASE_URL;
    if (!connectionString) {
      console
      return { statusCode: 500, body: JSON.stringify({ error: 'Database connection failed' }) };
    }

    const sql = neon(connectionString);

    // Get user by email
    const users = await sql('SELECT id, email, password_hash, name, phone, shipping_addr, cart, is_admin, is_verified, reset_token FROM users WHERE email = $1', [email]);

    if (users.length === 0) {
      console.error('Login error: Invalid email or password');
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid email or password' }) };
    }

    const user = users[0];

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid email or password' }) };

    if (user.reset_token) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Password reset pending. Please complete the reset process or request a new link.' }) };
    }

    if (!user.is_verified) {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ error: 'Email not verified', notVerified: true }) 
      };
    }

    // Generate Session Token
    const secret = process.env.JWT_SECRET || 'default_secret_change_me';
    const payload = Buffer.from(JSON.stringify({ 
      userId: user.id, 
      email: user.email,
      iat: Date.now() // Add timestamp to make token unique
    })).toString('base64');
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const token = `${payload}.${signature}`;

    // Save token to DB
    await sql('UPDATE users SET session_token = $1 WHERE id = $2', [token, user.id]);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          shipping_addr: user.shipping_addr,
          cart: user.cart || [],
          is_admin: !!user.is_admin
        }
      })
    };

  } catch (error: any) {
    console.error('Login error very bad:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Login failed' })
    };
  }
};
