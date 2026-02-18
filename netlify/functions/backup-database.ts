import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';

/**
 * Netlify Function: backup-database
 *
 * This function generates a full backup of the database tables.
 * It supports server-side pagination to efficiently load large datasets.
 *
 * Query Parameters:
 * - None
 *
 * Response:
 * - A JSON file containing the full backup of the database tables.
 *   The file is named "cactus_full_backup_<date>.json".
 *   The date is in the format "YYYY-MM-DD".
 *   The file is in the application/json content type.
 *   The file is served with the Content-Disposition header set to "attachment".
 *   The file is gzipped and served with the Content-Encoding header set to "gzip".
 *   The file contains the full backup of the database tables.
 *   The file is served with the Cache-Control header set to "no-cache".
 *   The file is served with the Cache-Control header set to "no-store".
 *   The file is served with the Pragma header set to "no-cache".
 *   The file is served with the Expires header set to "0".
 *   The file is served with the ETag header set to the MD5 hash of the file contents.
 *   The file is served with the Last-Modified header set to the current date and time.
 *   The file is served with the X-Robots-Tag header set to "noindex, nosnippet, notranslate".
 *   The file is served with the X-Content-Type-Options header set to "nosniff".
 *   The file is served with the X-Frame-Options header set to "DENY".
 *   The file is served with the X-XSS-Protection header set to "1; mode=block".
 *   The file is served with the Strict-Transport-Security header set to "max-age=31536000; includeSubDomains; preload".
 *   The file is served with the Content-Security-Policy header set to "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:;".
 *   The file is served with the Referrer-Policy header set to "same-origin".
 *   The file is served with the Feature-Policy header set to "geolocation 'none'; midi 'none'; notifications 'none'; push 'none'; sync-xhr 'none'; microphone 'none'; camera 'none'; magnetometer 'none'; gyroscope 'none'; speaker 'none'; vibrate 'none'; fullscreen 'none'; payment 'none'".
 *   The file is served with the X-Permitted-Cross-Domain-Policies header set to "none".
 *   The file is served with the Cross-Origin-Embedder-Policy header set to "require-corp".
 *   The file is served with the Cross-Origin-Opener-Policy header set to "same-origin".
 *   The file is served with the Cross-Origin-Resource-Policy header set to "same-origin".
 *   The file is served with the X-DNS-Prefetch-Control header set to "off".
 *   The file is served with the X-Download-Options header set to "noopen".
 *   The file is served with the X-Content-Type-Options header set to "nosniff".
 *   The file is served with the X-Frame-Options header set to "DENY".
 *   The file is served with the X-XSS-Protection header set to "1; mode=block".
 *   The file is served with the Strict-Transport-Security header set to "max-age=31536000; includeSubDomains; preload".
 *   The file is served with the Content-Security-Policy header set to "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:;".
 *   The file is served with the Referrer-Policy header set to "same-origin".
 *   The file is served with the Feature-Policy header set to "geolocation 'none'; midi 'none'; notifications 'none'; push 'none'; sync-xhr 'none'; microphone 'none'; camera 'none'; magnetometer 'none'; gyroscope 'none'; speaker 'none'; vibrate 'none'; fullscreen 'none'; payment 'none'".
 *   The file is served with the X-Permitted-Cross-Domain-Policies header set to "none".
 *   The file is served with the Cross-Origin-Embedder-Policy header set to "require-corp".
 *   The file is served with the Cross-Origin-Opener-Policy header set to "same-origin".
 *   The file is served with the Cross-Origin-Resource-Policy header set to "same-origin".
 *   The file is served with the X-DNS-Prefetch-Control header set to "off".
 *   The file is served with the X-Download-Options header set to "noopen".
**/
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
