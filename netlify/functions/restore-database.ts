import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sql = neon(process.env.NETLIFY_DATABASE_URL!);

  try {
    const backupData = JSON.parse(event.body || '{}');
    
    if (!backupData || Object.keys(backupData).length === 0) {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid backup data" }) };
    }

    // 1. Truncate all tables to ensure clean state
    // We use CASCADE to handle foreign key constraints automatically
    const tablesToTruncate = [
        'webhook_events', 'payments', 'order_items', 'orders', 
        'users', 'discounts', 'inventory_events', 'inventory', 
        'products', 'plant_classes', 'settings', 'audit_logs', 'statuses'
    ];

    for (const table of tablesToTruncate) {
        try {
             const check = await sql`SELECT 1 FROM information_schema.tables WHERE table_name = ${table}`;
             if (check.length > 0) {
                 await sql(`TRUNCATE TABLE ${table} CASCADE`);
             }
        } catch (e) {
            console.warn(`Failed to truncate ${table}`, e);
        }
    }

    // 2. Insert data in dependency order
    const insertOrder = [
        'discounts', 'statuses', 'plant_classes', 'settings', 'products',
        'users', 'inventory', 
        'orders', 
        'order_items', 'payments', 'inventory_events', 'webhook_events', 'audit_logs'
    ];

    let totalRows = 0;

    for (const table of insertOrder) {
        const rows = backupData[table];
        if (Array.isArray(rows) && rows.length > 0) {
            for (const row of rows) {
                 const cols = Object.keys(row);
                 const vals = Object.values(row).map(val => {
                     if (val !== null && typeof val === 'object') {
                         return JSON.stringify(val);
                     }
                     return val;
                 });
                 
                 if (cols.length === 0) continue;

                 const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(', ');
                 
                 try {
                    await sql.query(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`, vals);
                    totalRows++;
                 } catch (err: any) {
                     console.error(`Error inserting into ${table}:`, err);
                     throw new Error(`Failed to insert into ${table}: ${err.message}`);
                 }
            }
        }
    }
    
    // 3. Reset sequences for tables with auto-increment IDs
    const tablesWithId = ['products', 'users', 'orders', 'order_items', 'payments', 'inventory_events', 'plant_classes', 'audit_logs', 'webhook_events'];

    for (const table of tablesWithId) {
        try {
            // Reset sequence to max(id) + 1
            await sql(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(max(id), 1)) FROM ${table}`);
        } catch (e) {
            // Ignore errors if table/sequence doesn't exist or id is not serial
        }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Restore successful. Restored ${totalRows} rows.` })
    };

  } catch (e: any) {
    console.error("Restore failed:", e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
