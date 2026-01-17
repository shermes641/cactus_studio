import { Handler } from "@netlify/functions";
import { neon } from "@neondatabase/serverless";
import sharp from "sharp";
import crypto from "crypto";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD;
    const uploadPreset = process.env.CLOUDINARY_PRESET_SIGNED;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const databaseUrl = process.env.DATABASE_URL;

    if (!cloudName || !uploadPreset || !apiKey || !apiSecret || !databaseUrl) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing environment variables" })
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const limit = body.limit ?? 5;
    const lastId = body.lastId ?? 0;
    const force = body.force ?? false;
    const folder = body.folder ?? "cactus";

    const sql = neon(databaseUrl);

    // Fetch next batch using cursor
    const products = await sql`
      SELECT id, name, image_url
      FROM products
      WHERE id > ${lastId}
        AND (
          ${force} = true
          OR image_url NOT LIKE '%res.cloudinary.com%'
        )
      ORDER BY id
      LIMIT ${limit}
    `;

    if (products.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "No more products",
          hasMore: false,
          lastId
        })
      };
    }

    let updated = 0;
    const failures: Array<{ id: number; error: string }> = [];

    for (const product of products) {
      try {
        const imageRes = await fetch(product.image_url, {
          signal: AbortSignal.timeout(10000),
          headers: {
            "User-Agent": "Mozilla/5.0 (ImageMigrator)"
          }
        });

        if (!imageRes.ok) {
          throw new Error("Failed to fetch image");
        }

        const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

        const optimized = await sharp(imageBuffer)
          .resize(1200, null, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();

        const base64Image = optimized.toString("base64");

        const publicId =
          `product_${product.id}_` +
          product.name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

        const timestamp = Math.round(Date.now() / 1000);

        // Build signed params
        const params = {
          folder,
          invalidate: true,
          public_id: publicId,
          timestamp,
          upload_preset: uploadPreset
        };

        const paramsStr = Object.keys(params)
          .sort()
          .map((k) => `${k}=${params[k as keyof typeof params]}`)
          .join("&");

        const signature = crypto
          .createHash("sha1")
          .update(paramsStr + apiSecret)
          .digest("hex");

        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file: `data:image/webp;base64,${base64Image}`,
              api_key: apiKey,
              timestamp,
              signature,
              upload_preset: uploadPreset,
              public_id: publicId,
              folder,
              invalidate: true
            }),
            signal: AbortSignal.timeout(15000)
          }
        );

        const uploadData = await uploadRes.json();

        if (!uploadRes.ok) {
          throw new Error(uploadData.error?.message || "Upload failed");
        }

        await sql`
          UPDATE products
          SET image_url = ${uploadData.secure_url}
          WHERE id = ${product.id}
        `;

        updated++;
      } catch (err) {
        failures.push({
          id: product.id,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    const newLastId = products[products.length - 1].id;

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Batch complete: ${updated} uploaded`,
        updated,
        failures,
        lastId: newLastId,
        hasMore: products.length === limit
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Unhandled error",
        details: err instanceof Error ? err.message : String(err)
      })
    };
  }
};
