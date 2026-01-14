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
  const { search } = params;

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

    let baseQuery = `SELECT p.*, i.quantity, i.sku FROM products p LEFT JOIN inventory i ON p.id = i.image_id`;
    let countQuery = `SELECT COUNT(*) FROM products p LEFT JOIN inventory i ON p.id = i.image_id`;
    
    const conditions: string[] = [];
    const args: any[] = [];

    if (productClass && productClass !== 'All') {
        conditions.push(`p.class = $${args.length + 1}`);
        args.push(productClass);
    }
    
    if (search && search.length >= 2) {
        const term = `%${search}%`;
        const idx = args.length + 1;
        conditions.push(`(p.name ILIKE $${idx} OR (p.price_cents / 100.0)::text ILIKE $${idx} OR i.sku ILIKE $${idx})`);
        args.push(term);
    }
    
    if (conditions.length > 0) {
        const where = ' WHERE ' + conditions.join(' AND ');
        baseQuery += where;
        countQuery += where;
    }
    
    baseQuery += ` ORDER BY p.id LIMIT ${limit} OFFSET ${offset}`;
    
    const totalRes = await sql(countQuery, args);
    const rows = await sql(baseQuery, args);

    const total = parseInt(totalRes[0].count);

    return {
        statusCode: 200,
        body: JSON.stringify({ products: rows, total: total })
    };
  } catch (e: any) {
      return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
