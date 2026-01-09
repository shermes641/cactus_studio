import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';
import bcrypt from 'bcryptjs';

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

    // Insert new user
    const result = await sql(
      'INSERT INTO users (email, password_hash, name, shipping_addr, cart) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, shipping_addr, cart',
      [email, hashed, name || null, shipping_addr || null, JSON.stringify([])]
    );

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'User registered successfully',
        user: result[0]
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
