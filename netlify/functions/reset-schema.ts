import { Handler } from "@netlify/functions";
import { neon } from '@netlify/neon';
import { 
  creationOrder, 
  dropOrder,
  SEED_DISCOUNTS,
  SEED_PLANT_CLASSES,
  SEED_STATUSES,
  SEED_SETTINGS
} from "./schema.js";

export const handler: Handler = async (event: any, context: any) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sql = neon(process.env.NETLIFY_DATABASE_URL!);

  try {
    // 1. Drop Tables (Reverse Dependency Order)
    for (const table of dropOrder) {
       await sql.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }

    // 2. Create Tables (Dependency Order)
    for (const createSql of creationOrder) {
       await sql.query(createSql);
    }

    // 3. Seed Initial Data
     await sql.query(SEED_DISCOUNTS);

     await sql.query(SEED_PLANT_CLASSES);

     await sql.query(SEED_STATUSES);

     await sql.query(SEED_SETTINGS);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Schema reset and tables created successfully." })
    };

  } catch (error: any) {
    console.error("Schema reset failed:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
