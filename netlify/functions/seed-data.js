/**
 * Netlify Function: seed-data
 *
 * This function synchronizes the local `data.json` file (or provided payload)
 * with the Neon PostgreSQL database. It handles table creation, schema validation,
 * and data insertion.
 */
const { neon } = require('@netlify/neon');

exports.handler = async (event, context) => {
  // Only allow POST requests to trigger this (or GET for testing in browser)
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let sql;
  
  try {
    // 1. Load Data
    let data;
    let force = false;

    // 1a. Try to use data sent from frontend (includes Admin edits)
    if (event.body) {
      try {
        const body = JSON.parse(event.body);
        // Handle both legacy array and new object format
        data = Array.isArray(body) ? body : body.products;
        force = body.force === true;
      } catch (e) {
        console.log("No JSON body provided, falling back to file.");
      }
    }

    // 1b. Fallback to disk file if no body sent
    if (!data) {
      data = require('../../data.json');
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ message: "No data found in data.json" }) };
    }

    // Analyze schema from the first item in data.json
    const sampleItem = data[0];
    const jsonColumns = Object.keys(sampleItem);
    const tableName = 'products';

    // 2. Connect to Current DB (Main Branch)
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing DATABASE_URL environment variable." }) };
    }

    sql = neon(connectionString);

    // If force is true, skip checks and recreate immediately
    if (force) {
      await createTableAndInsert(sql, tableName, jsonColumns, sampleItem, data);
      return { statusCode: 200, body: JSON.stringify({ message: "Table recreated and data synced." }) };
    }

    // 3. Check Schema
    let schemaMismatch = false;

    // Query information_schema to see if table exists and has correct columns
    const tableCheckRes = await sql(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [tableName]);

    if (tableCheckRes.length === 0) {
      console.log("Table does not exist. Creating...");
      await createTableAndInsert(sql, tableName, jsonColumns, sampleItem, data);
      return { statusCode: 200, body: JSON.stringify({ message: "Table created and data synced." }) };
    } else {
      const dbColumns = tableCheckRes.map(row => row.column_name);
      // Check if any key in JSON is missing from DB
      const missingColumns = jsonColumns.filter(col => !dbColumns.includes(col));
      if (missingColumns.length > 0) {
        console.log("Schema mismatch. Missing columns:", missingColumns);
        schemaMismatch = true;
      }

      // Check if price is integer (needs to be numeric)
      const priceCol = tableCheckRes.find(row => row.column_name === 'price');
      if (priceCol && priceCol.data_type === 'integer') {
        console.log("Schema mismatch. Price is integer, switching to numeric.");
        schemaMismatch = true;
      }
    }

    // 4. Logic: If Schema Changed, return 409 to prompt user
    if (schemaMismatch) {
      return { statusCode: 409, body: JSON.stringify({ error: "Schema mismatch detected." }) };
    }

    // --- Sync Data to Current DB ---
    console.log("Schema matches. Syncing data...");
    let insertedCount = 0;

    try {
      for (const item of data) {
        // Check if ID exists
        const checkRes = await sql(`SELECT 1 FROM ${tableName} WHERE id = $1`, [item.id]);
        
        if (checkRes.length === 0) {
          const keys = Object.keys(item);
          const values = Object.values(item);
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
          await sql(`INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`, values);
          insertedCount++;
        }
      }
    } catch (err) {
      console.error("Insert failed:", err);
      return { statusCode: 409, body: JSON.stringify({ error: `Insert failed: ${err.message}` }) };
    }

    return { statusCode: 200, body: JSON.stringify({ message: "Synced data to current database.", inserted: insertedCount }) };

  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ error: `Error: ${error.message}` }) };
  }
};

// Helper function to handle table creation and insertion
async function createTableAndInsert(sql, tableName, jsonColumns, sampleItem, data) {
  // Create Table
  const colDefs = jsonColumns.map(key => {
    const val = sampleItem[key];
    // Simple type inference
    let type = 'TEXT';
    if (typeof val === 'number') type = (Number.isInteger(val) && key !== 'price') ? 'INTEGER' : 'NUMERIC';
    if (key === 'id') return `${key} ${type} PRIMARY KEY`;
    return `${key} ${type}`;
  }).join(', ');

  await sql(`DROP TABLE IF EXISTS ${tableName}`);
  await sql(`CREATE TABLE ${tableName} (${colDefs})`);

  // Insert Data
  for (const item of data) {
    const keys = Object.keys(item);
    const values = Object.values(item);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    await sql(`INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`, values);
  }
}

// Allow running this script directly via Node for testing
// Usage: set DATABASE_URL=... && node netlify/functions/seed-data.js
if (require.main === module) {
  exports.handler({ httpMethod: 'POST' }, {})
    .then(res => console.log("Direct run result:", res))
    .catch(err => console.error("Direct run error:", err));
}