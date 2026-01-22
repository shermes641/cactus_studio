import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sql = neon(process.env.NETLIFY_DATABASE_URL!);

  try {
    const tables = [
        'products', 'inventory', 'inventory_events', 'users', 'discounts', 
        'orders', 'order_items', 'payments', 'webhook_events', 'statuses', 
        'plant_classes', 'settings', 'audit_logs'
    ];
    const backup: any = {};

    for (const table of tables) {
        try {
            // Check if table exists
            const check = await sql`SELECT 1 FROM information_schema.tables WHERE table_name = ${table}`;
            if (check.length > 0) {
                 // Use string concatenation for table name as it is from a trusted hardcoded list
                 const rows = await sql(`SELECT * FROM ${table}`);
                 backup[table] = rows;
            }
        } catch (e) {
            console.warn(`Skipping table ${table}:`, e);
        }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="cactus_full_backup_${new Date().toISOString().split('T')[0]}.json"`
      },
      body: JSON.stringify(backup, null, 2)
    };

  } catch (e: any) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
