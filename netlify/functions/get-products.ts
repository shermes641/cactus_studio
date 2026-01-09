/**
 * Netlify Function: get-products
 *
 * This serverless function handles fetching product data from the Neon PostgreSQL database.
 * It supports server-side pagination to efficiently load large datasets.
 *
 * Query Parameters:
 * - page: The page number to fetch (default: 1)
 * - limit: The number of items per page (default: 20)
 */
import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event: any, context: any) => {
  const params = event.queryStringParameters || {};
  const { id } = params;
  const page = parseInt(params.page || '1');
  const limit = parseInt(params.limit || '20');
  const offset = (page - 1) * limit;
  const productClass = params.class;

  // Check if DB URL is set
  if (!process.env.NETLIFY_DATABASE_URL) {
     return { statusCode: 500, body: JSON.stringify({ error: "No DB URL" }) };
  }
  // Initialize Neon SQL connection
  const sql = neon(process.env.NETLIFY_DATABASE_URL);

  try {
    // Check if table exists
    const tableCheck = await sql`SELECT 1 FROM information_schema.tables WHERE table_name = 'products'`;
    if (tableCheck.length === 0) {
        return { statusCode: 404, body: JSON.stringify({ error: "Table not found" }) };
    }

    // Fetch single product if ID is provided
    if (id) {
      const rows = await sql`
        SELECT p.*, i.quantity 
        FROM products p 
        LEFT JOIN inventory i ON p.id = i.image_id 
        WHERE p.id = ${id}`;
      
      return { statusCode: 200, body: JSON.stringify({ products: rows, total: rows.length }) };
    }

    let totalRes;
    let rows;

    if (productClass && productClass !== 'All') {
      // Filter by class
      totalRes = await sql`SELECT COUNT(*) FROM products WHERE class = ${productClass}`;
      rows = await sql`
        SELECT p.*, i.quantity 
        FROM products p 
        LEFT JOIN inventory i ON p.id = i.image_id 
        WHERE p.class = ${productClass}
        ORDER BY p.id LIMIT ${limit} OFFSET ${offset}`;
    } else {
      // No filter
      totalRes = await sql`SELECT COUNT(*) FROM products`;
      rows = await sql`
        SELECT p.*, i.quantity 
        FROM products p 
        LEFT JOIN inventory i ON p.id = i.image_id 
        ORDER BY p.id LIMIT ${limit} OFFSET ${offset}`;
    }

    const total = parseInt(totalRes[0].count);

    return {
        statusCode: 200,
        body: JSON.stringify({ products: rows, total: total })
    };
  } catch (e: any) {
      return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
