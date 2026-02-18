/**
 * Netlify Function: seed-data
 *
 * This function synchronizes the local `data.json` file (or provided payload)
 * with the Neon PostgreSQL database. It handles table creation, schema validation,
 * and data insertion.
 */
import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';
// @ts-ignore
import localData from '../../data.json';
import { CREATE_PRODUCTS_TABLE } from "./schema.js";
import { genSku } from "./shared.js";

export const handler: Handler = async (event: any, context: any) => {
  // Only allow POST requests to trigger this (or GET for testing in browser)
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let sql;
  
  try {
    // 1. Parse Input
    let data: any[] | undefined;
    let resetInventory = false;

    if (event.body) {
      try {
        const body = JSON.parse(event.body);
        data = Array.isArray(body) ? body : body.products;
        resetInventory = body.resetInventory === true;
      } catch (e) {
        console.log("No JSON body provided, falling back to file.");
      }
    }

    // 1b. Fallback to disk file if no body sent
    if (!data) {
      data = localData;
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ message: "No data found in data.json" }) };
    }

    // Analyze schema from the first item in data.json
    const sampleItem = data[0];
    const jsonColumns = Object.keys(sampleItem);
    const tableName = 'products';
    let messages: string[] = [];

    const connectionString = process.env.NETLIFY_DATABASE_URL;
    if (!connectionString) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing NETLIFY_DATABASE_URL environment variable." }) };
    }

    sql = neon(connectionString);

    // 1.5 Truncate Table (Clean Sync)
    try {
      const check = await sql`SELECT 1 FROM information_schema.tables WHERE table_name = ${tableName}`;
      if (check.length > 0) {
        await sql.query(`TRUNCATE TABLE ${tableName} CASCADE`);
        messages.push("Truncated products table.");
      }
    } catch (e) { console.error("Truncate error:", e); }

    // 2. Schema Check & Fix (Products)
    const tableCheckRes = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = ${tableName}
    `;

    if (tableCheckRes.length === 0) {
      await sql.query(CREATE_PRODUCTS_TABLE);
      messages.push("Created products table from canonical schema.");
    } else {
      // Check for missing columns
      const dbColumns = tableCheckRes.map((row: any) => row.column_name);
      const missingColumns = jsonColumns.filter(col => !dbColumns.includes(col));
      
      if (missingColumns.length > 0) {
        for (const col of missingColumns) {
          const val = sampleItem[col];
          let type = 'TEXT';
          if (typeof val === 'number') type = 'INTEGER';
          if (typeof val === 'boolean') type = 'BOOLEAN';
          await sql.query(`ALTER TABLE ${tableName} ADD COLUMN ${col} ${type}`);
        }
        messages.push(`Added missing columns: ${missingColumns.join(', ')}.`);
      }
    }

    // 3. Sync Products Data
    let insertedCount = 0;
    for (const item of data) {
      const checkRes = await sql`SELECT id FROM ${tableName} WHERE id = ${item.id}`;
      if (checkRes.length === 0) {
        const keys = Object.keys(item);
        const values = Object.values(item);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        await sql.query(`INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`, values);
        insertedCount++;
      }
    }
    if (insertedCount > 0) messages.push(`Inserted ${insertedCount} new products.`);

    // 3.5 Fix Sequence (Critical for BIGSERIAL to work after manual inserts)
    try {
      await sql.query(`SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), COALESCE(max(id), 1)) FROM ${tableName}`);
      messages.push("Updated ID sequence.");
    } catch (e) { console.error("Sequence fix error:", e); }

    // 4. Handle Inventory Reset
    if (resetInventory) {
      await sql`DELETE FROM inventory_events`;
      await sql`DELETE FROM inventory`;
      
      for (const item of data) {
        const sku = genSku(item.class, item.name, item.id);
        await sql`INSERT INTO inventory (sku, image_id, quantity) VALUES (${sku}, ${item.id}, 1)`;
      }
      messages.push("Inventory reset to quantity 1.");
    }

    return { statusCode: 200, body: JSON.stringify({ message: messages.join(' ') || "Data synced (no changes)." }) };

  } catch (error: any) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ error: `Error: ${error.message}` }) };
  }
};
