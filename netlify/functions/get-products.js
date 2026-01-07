const { neon } = require('@netlify/neon');

exports.handler = async (event, context) => {
  const page = parseInt(event.queryStringParameters.page) || 1;
  const limit = parseInt(event.queryStringParameters.limit) || 20;
  const offset = (page - 1) * limit;

  if (!process.env.DATABASE_URL) {
     return { statusCode: 500, body: JSON.stringify({ error: "No DB URL" }) };
  }
  const sql = neon(process.env.DATABASE_URL);

  try {
    // Check if table exists
    const tableCheck = await sql`SELECT 1 FROM information_schema.tables WHERE table_name = 'products'`;
    if (tableCheck.length === 0) {
        return { statusCode: 404, body: JSON.stringify({ error: "Table not found" }) };
    }

    // Get total count for pagination
    const totalRes = await sql`SELECT COUNT(*) FROM products`;
    const total = parseInt(totalRes[0].count);

    // Fetch paginated rows
    const rows = await sql`SELECT * FROM products ORDER BY id LIMIT ${limit} OFFSET ${offset}`;

    return {
        statusCode: 200,
        body: JSON.stringify({ products: rows, total: total })
    };
  } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};